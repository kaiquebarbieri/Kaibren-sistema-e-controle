import { Express, Request, Response } from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
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
 * Parse bank statement text (tab-separated C6 Bank format) into structured transactions.
 * 
 * Format per line:
 *   DD/MM \t DD/MM \t Tipo \t Descrição \t [-]R$ X.XXX,XX
 * 
 * Also handles "Saldo do dia" lines (skipped).
 */
function parseExtractText(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n");

  // Date pattern at start of line: DD/MM
  const dateRegex = /^(\d{2}\/\d{2})\s/;
  // Value pattern: optional minus, R$, then number with dots and comma
  const valueRegex = /(-?)R\$\s*([\d.]+,\d{2})/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip "Saldo do dia" lines
    if (trimmed.startsWith("Saldo do dia")) continue;

    // Check if line starts with a date
    if (!dateRegex.test(trimmed)) continue;

    // Split by tabs
    const parts = trimmed.split("\t").map(p => p.trim());

    // Expected: [date, date_contabil, tipo, descricao, valor]
    // Sometimes there are 4 or 5 parts
    if (parts.length < 4) continue;

    const date = parts[0]; // DD/MM
    // Find the value (last part that contains R$)
    let valueStr = "";
    let description = "";
    let tipo = "";

    if (parts.length >= 5) {
      // Standard format: date, date_contabil, tipo, descricao, valor
      tipo = parts[2];
      description = parts[3];
      valueStr = parts[4];
    } else if (parts.length === 4) {
      // Could be: date, date_contabil, tipo, descricao (no value)
      // or: date, tipo, descricao, valor
      tipo = parts[2];
      description = parts[3];
      // Check if description contains a value
      const valMatch = description.match(valueRegex);
      if (valMatch) {
        valueStr = description;
        description = parts[2];
        tipo = parts[1];
      }
    }

    // Extract monetary value
    const valMatch = valueStr.match(valueRegex);
    if (!valMatch) {
      // Try to find value in description or tipo
      const descValMatch = description.match(valueRegex);
      if (descValMatch) {
        valueStr = description;
        // Re-extract
        const m = valueStr.match(valueRegex);
        if (m) {
          const rawValue = m[2].replace(/\./g, "").replace(",", ".");
          const numVal = parseFloat(rawValue);
          if (!isNaN(numVal)) {
            const isNegative = m[1] === "-";
            transactions.push({
              transactionDate: date,
              originalDescription: `${tipo} - ${description.replace(valueRegex, "").trim()}`.trim(),
              amount: numVal.toFixed(2),
              transactionType: isNegative ? "debit" : "credit",
            });
          }
        }
      }
      continue;
    }

    const rawValue = valMatch[2].replace(/\./g, "").replace(",", ".");
    const numVal = parseFloat(rawValue);
    if (isNaN(numVal) || numVal === 0) continue;

    const isNegative = valMatch[1] === "-";

    // Build full description with tipo
    let fullDescription = description;
    if (tipo && tipo !== description) {
      fullDescription = `${tipo} - ${description}`;
    }

    transactions.push({
      transactionDate: date,
      originalDescription: fullDescription || "Transação sem descrição",
      amount: numVal.toFixed(2),
      transactionType: isNegative ? "debit" : "credit",
    });
  }

  return transactions;
}

/**
 * Extract text from PDF buffer, with optional password support.
 * Uses pdf-parse v2 PDFParse class.
 */
async function extractPdfText(buffer: Buffer, password?: string): Promise<string> {
  const options: any = {
    verbosity: 0,
    data: new Uint8Array(buffer),
  };
  if (password) {
    options.password = password;
  }

  const parser = new PDFParse(options);
  await (parser as any).load();
  const result = await (parser as any).getText();

  // result is { pages: [{ text: string }] }
  if (result && typeof result === "object" && "pages" in result) {
    return (result as any).pages.map((p: any) => p.text).join("\n");
  }
  if (typeof result === "string") {
    return result;
  }
  return JSON.stringify(result);
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
      const pdfPassword = (req.body.pdfPassword as string) || undefined;

      // Upload PDF to S3
      const suffix = crypto.randomBytes(4).toString("hex");
      const fileKey = `bank-statements/${periodYear}-${String(periodMonth).padStart(2, "0")}/${file.originalname.replace(/\s+/g, "_")}-${suffix}.pdf`;
      const { url: fileUrl } = await storagePut(fileKey, file.buffer, "application/pdf");

      // Parse PDF (with optional password for protected PDFs)
      let parsedTransactions: ParsedTransaction[] = [];
      try {
        const text = await extractPdfText(file.buffer, pdfPassword);
        parsedTransactions = parseExtractText(text);
      } catch (parseError: any) {
        console.error("PDF parse error:", parseError);
        // Check if it's a password error
        const errMsg = String(parseError?.message || "").toLowerCase();
        if (errMsg.includes("password") || errMsg.includes("encrypted") || errMsg.includes("need a password")) {
          return res.status(400).json({ 
            error: "O PDF é protegido por senha. Informe a senha correta no campo 'Senha do PDF'.",
            needsPassword: true,
          });
        }
        // Even if parsing fails for other reasons, we save the statement
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
