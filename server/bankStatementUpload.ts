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
  accountingDate: string;
  bankType: string;
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

    // Skip "Saldo do dia" lines and header lines
    if (trimmed.startsWith("Saldo do dia")) continue;
    if (trimmed.startsWith("Data")) continue;
    if (trimmed.startsWith("lançamento")) continue;
    if (trimmed.startsWith("contábil")) continue;

    // Check if line starts with a date
    if (!dateRegex.test(trimmed)) continue;

    // Split by tabs
    const parts = trimmed.split("\t").map(p => p.trim());

    // Expected: [date_lancamento, date_contabil, tipo, descricao, valor]
    if (parts.length < 4) continue;

    let dateLancamento = parts[0]; // DD/MM
    let dateContabil = "";
    let tipo = "";
    let description = "";
    let valueStr = "";

    if (parts.length >= 5) {
      // Standard format: date_lancamento, date_contabil, tipo, descricao, valor
      dateContabil = parts[1];
      tipo = parts[2];
      description = parts[3];
      valueStr = parts[4];
    } else if (parts.length === 4) {
      // Might be: date_lancamento, date_contabil, tipo, descricao (no value inline)
      dateContabil = parts[1];
      tipo = parts[2];
      description = parts[3];
    }

    // Extract monetary value
    const valMatch = valueStr.match(valueRegex);
    if (!valMatch) {
      // Try to find value in description
      const descValMatch = description.match(valueRegex);
      if (descValMatch) {
        const rawValue = descValMatch[2].replace(/\./g, "").replace(",", ".");
        const numVal = parseFloat(rawValue);
        if (!isNaN(numVal) && numVal > 0) {
          const isNegative = descValMatch[1] === "-";
          const cleanDesc = description.replace(valueRegex, "").trim();
          transactions.push({
            transactionDate: dateLancamento,
            accountingDate: dateContabil,
            bankType: tipo,
            originalDescription: cleanDesc || tipo || "Transação sem descrição",
            amount: numVal.toFixed(2),
            transactionType: isNegative ? "debit" : "credit",
          });
        }
      }
      continue;
    }

    const rawValue = valMatch[2].replace(/\./g, "").replace(",", ".");
    const numVal = parseFloat(rawValue);
    if (isNaN(numVal) || numVal === 0) continue;

    const isNegative = valMatch[1] === "-";

    transactions.push({
      transactionDate: dateLancamento,
      accountingDate: dateContabil,
      bankType: tipo,
      originalDescription: description || "Transação sem descrição",
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
      const cnpjId = parseInt(req.body.cnpjId as string);
      const pdfPassword = (req.body.pdfPassword as string) || undefined;

      if (!Number.isFinite(cnpjId) || cnpjId <= 0) {
        return res.status(400).json({ error: "Selecione o CNPJ vinculado a este extrato." });
      }

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
        const errMsg = String(parseError?.message || "").toLowerCase();
        if (errMsg.includes("password") || errMsg.includes("encrypted") || errMsg.includes("need a password")) {
          return res.status(400).json({ 
            error: "O PDF é protegido por senha. Informe a senha correta no campo 'Senha do PDF'.",
            needsPassword: true,
          });
        }
      }

      // Create statement record
      const { id: statementId } = await createBankStatement({
        cnpjId,
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

      // Create transaction records with all parsed fields
      if (parsedTransactions.length > 0) {
        await createBankTransactions(
          parsedTransactions.map(t => ({
            statementId,
            transactionDate: t.transactionDate,
            accountingDate: t.accountingDate || null,
            bankType: t.bankType || null,
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
