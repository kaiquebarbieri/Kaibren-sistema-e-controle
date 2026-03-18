import { Express, Request, Response } from "express";
import multer from "multer";
import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import { storagePut } from "./storage";
import {
  createBankStatement,
  createBankTransactions,
  recalcStatementCounts,
} from "./db";
import crypto from "crypto";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/* ── PDF Parsing Logic ── */

interface ParsedTransaction {
  transactionDate: string;
  originalDescription: string;
  amount: string;
  transactionType: "credit" | "debit";
}

/**
 * Parse bank statement PDF text into structured transactions.
 * Supports common Brazilian bank formats (Nubank, Itaú, Bradesco, Sicoob, Inter, C6, etc.)
 */
function parseExtractText(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Common date patterns: DD/MM/YYYY, DD/MM/YY, DD/MM
  const dateRegex = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)/;
  // Value pattern: R$ 1.234,56 or 1.234,56 or 1234,56 (with optional - or + prefix)
  const valueRegex = /[+-]?\s*R?\$?\s*([\d.,]+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    const date = dateMatch[1];
    const rest = line.substring(dateMatch[0].length).trim();

    // Try to find a monetary value in the rest of the line
    // Look for patterns like: description ... R$ 1.234,56 or description ... 1.234,56
    const parts = rest.split(/\s+/);
    let amount: string | null = null;
    let description = "";
    let type: "credit" | "debit" = "debit";

    // Try to find value from the end of the line
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j].replace(/R\$/, "").trim();
      // Check if this looks like a monetary value (has comma for decimals)
      if (/^[+-]?[\d.]+,\d{2}$/.test(part)) {
        const rawValue = part.replace(/\./g, "").replace(",", ".");
        const numVal = parseFloat(rawValue);
        if (!isNaN(numVal)) {
          amount = Math.abs(numVal).toFixed(2);
          type = numVal < 0 || rest.toLowerCase().includes("débito") || rest.toLowerCase().includes("saída") || rest.toLowerCase().includes("pagamento") || rest.toLowerCase().includes("pix enviado") || rest.toLowerCase().includes("transferência enviada") ? "debit" : "credit";
          
          // Check for credit indicators
          if (rest.toLowerCase().includes("crédito") || rest.toLowerCase().includes("entrada") || rest.toLowerCase().includes("pix recebido") || rest.toLowerCase().includes("transferência recebida") || rest.toLowerCase().includes("depósito")) {
            type = "credit";
          }
          
          description = parts.slice(0, j).join(" ").replace(/R\$/g, "").trim();
          break;
        }
      }
    }

    // If no value found in the same line, try next line
    if (!amount && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const nextMatch = nextLine.match(/[+-]?\s*R?\$?\s*([\d.]+,\d{2})/);
      if (nextMatch) {
        const rawValue = nextMatch[1].replace(/\./g, "").replace(",", ".");
        const numVal = parseFloat(rawValue);
        if (!isNaN(numVal)) {
          amount = numVal.toFixed(2);
          description = rest;
          type = nextLine.includes("-") || rest.toLowerCase().includes("débito") || rest.toLowerCase().includes("pagamento") ? "debit" : "credit";
          if (rest.toLowerCase().includes("crédito") || rest.toLowerCase().includes("entrada") || rest.toLowerCase().includes("pix recebido")) {
            type = "credit";
          }
          i++; // skip next line as it was the value
        }
      }
    }

    if (!amount) {
      // Line has a date but no value found - skip
      continue;
    }

    if (!description) {
      description = rest.replace(/[\d.,]+$/, "").trim() || "Transação sem descrição";
    }

    transactions.push({
      transactionDate: date,
      originalDescription: description,
      amount,
      transactionType: type,
    });
  }

  return transactions;
}

/* ── Express Route ── */

export function registerBankStatementUploadRoute(app: Express) {
  app.post("/api/bank-statement/upload", upload.single("file"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      const bankName = (req.body.bankName as string) || "Banco";
      const periodMonth = parseInt(req.body.periodMonth as string) || (new Date().getMonth() + 1);
      const periodYear = parseInt(req.body.periodYear as string) || new Date().getFullYear();

      // Upload PDF to S3
      const suffix = crypto.randomBytes(4).toString("hex");
      const fileKey = `bank-statements/${periodYear}-${String(periodMonth).padStart(2, "0")}/${file.originalname.replace(/\s+/g, "_")}-${suffix}.pdf`;
      const { url: fileUrl } = await storagePut(fileKey, file.buffer, "application/pdf");

      // Parse PDF
      let parsedTransactions: ParsedTransaction[] = [];
      try {
        const pdfData = await pdfParse(file.buffer);
        parsedTransactions = parseExtractText(pdfData.text);
      } catch (parseError) {
        console.error("PDF parse error:", parseError);
        // Even if parsing fails, we save the statement so user can see it
      }

      // Create statement record
      const { id: statementId } = await createBankStatement({
        bankName,
        periodMonth,
        periodYear,
        fileName: file.originalname,
        fileKey,
        fileUrl,
        totalTransactions: parsedTransactions.length,
        totalIdentified: 0,
        status: "pending",
      });

      // Create transaction records
      if (parsedTransactions.length > 0) {
        await createBankTransactions(
          parsedTransactions.map(t => ({
            statementId,
            transactionDate: t.transactionDate,
            originalDescription: t.originalDescription,
            amount: t.amount,
            transactionType: t.transactionType,
            isIdentified: 0,
          }))
        );
      }

      await recalcStatementCounts(statementId);

      return res.json({
        success: true,
        statementId,
        totalTransactions: parsedTransactions.length,
        fileUrl,
      });
    } catch (error: any) {
      console.error("Bank statement upload error:", error);
      return res.status(500).json({ error: error.message || "Erro ao processar extrato." });
    }
  });
}
