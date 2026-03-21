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

interface ParsedTransaction {
  transactionDate: string;
  accountingDate: string;
  bankType: string;
  originalDescription: string;
  amount: string;
  transactionType: "credit" | "debit";
  category?: string | null;
  userDescription?: string | null;
  notes?: string | null;
  isIdentified?: number;
}

const MONEY_REGEX = /R\$\s*(-?[\d.]+,\d{2})/;
const DATE_DASH_REGEX = /\b\d{2}-\d{2}-\d{4}\b/;
const OPERATION_ID_REGEX = /^\d{6,}$/;

function normalizeMoney(value: string): number {
  return parseFloat(value.replace(/\./g, "").replace(",", "."));
}

function normalizeDate(value: string): string {
  if (value.includes("-")) return value;
  const [day, month, year] = value.split("/");
  return `${day}/${month}${year ? `/${year}` : ""}`;
}

function inferMercadoPagoClassification(transaction: ParsedTransaction): ParsedTransaction {
  const raw = `${transaction.bankType || ""} ${transaction.originalDescription || ""}`.toLowerCase();

  const withMeta = (patch: Partial<ParsedTransaction>): ParsedTransaction => ({
    ...transaction,
    ...patch,
    isIdentified: patch.isIdentified ?? 1,
  });

  if (raw.includes("c6") || raw.includes("transfer") || raw.includes("pix enviado") || raw.includes("ted enviada")) {
    return withMeta({
      category: "Repasse para C6 Bank",
      userDescription: "Transferência do saldo do Mercado Pago para a conta C6 Bank",
      notes: "Movimento classificado automaticamente como repasse interno entre contas.",
    });
  }

  if (raw.includes("dívida") || raw.includes("reclama") || raw.includes("estorno") || raw.includes("devolu")) {
    return withMeta({
      category: "Ajustes e devoluções Mercado Pago",
      userDescription: "Ajuste, devolução ou débito operacional do Mercado Pago",
      notes: "Movimento classificado automaticamente como ajuste do ecossistema Mercado Pago/Mercado Livre.",
    });
  }

  if (raw.includes("mercado livre") || raw.includes("venda") || raw.includes("recebimento") || raw.includes("pagamento com código qr")) {
    return withMeta({
      category: transaction.transactionType === "credit" ? "Entrada Mercado Pago" : "Saída Mercado Pago",
      userDescription: transaction.transactionType === "credit"
        ? "Entrada recebida no Mercado Pago"
        : "Saída operacional registrada no Mercado Pago",
      notes: "Movimento classificado automaticamente a partir do extrato do Mercado Pago.",
    });
  }

  if (transaction.transactionType === "credit") {
    return withMeta({
      category: "Entrada Mercado Pago",
      userDescription: "Entrada recebida via Mercado Pago",
      notes: "Movimento de crédito classificado automaticamente no extrato do Mercado Pago.",
    });
  }

  return withMeta({
    category: "Saída Mercado Pago",
    userDescription: "Saída operacional via Mercado Pago",
    notes: "Movimento de débito classificado automaticamente no extrato do Mercado Pago.",
  });
}

export function autoIdentifyTransactions(transactions: ParsedTransaction[], bankName: string, sourceText?: string): ParsedTransaction[] {
  const normalizedBank = bankName.toLowerCase().trim();
  const normalizedText = String(sourceText || "").toLowerCase();
  const selectedMercadoPago = normalizedBank === "mercado pago";
  const matchesMercadoPagoLayout = normalizedText.includes("detalhe dos movimentos")
    && normalizedText.includes("id da operação")
    && normalizedText.includes("saldo")
    && (normalizedText.includes("mercado pago") || normalizedText.includes("mercado livre") || normalizedText.includes("pagamento com código qr"));

  if (!selectedMercadoPago || !matchesMercadoPagoLayout) {
    return transactions;
  }

  return transactions.map((transaction) => inferMercadoPagoClassification(transaction));
}

function parseTabularExtract(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("Saldo do dia") || trimmed.startsWith("Data") || trimmed.startsWith("lançamento") || trimmed.startsWith("contábil")) {
      continue;
    }

    if (!/^\d{2}\/\d{2}/.test(trimmed)) continue;

    const parts = trimmed.split("\t").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 4) continue;

    const transactionDate = parts[0];
    const accountingDate = parts[1] || "";
    const bankType = parts[2] || "";
    const originalDescription = parts[3] || "Transação sem descrição";
    const amountSource = parts.slice(4).join(" ") || originalDescription;
    const valueMatch = amountSource.match(/(-?)R\$\s*([\d.]+,\d{2})/);

    if (!valueMatch) continue;

    const amount = normalizeMoney(valueMatch[2]);
    if (!Number.isFinite(amount) || amount === 0) continue;

    transactions.push({
      transactionDate,
      accountingDate,
      bankType,
      originalDescription: originalDescription.replace(/(-?)R\$\s*[\d.]+,\d{2}/, "").trim() || "Transação sem descrição",
      amount: amount.toFixed(2),
      transactionType: valueMatch[1] === "-" ? "debit" : "credit",
    });
  }

  return transactions;
}

function parseMercadoPagoExtract(text: string): ParsedTransaction[] {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const transactions: ParsedTransaction[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const dateMatch = line.match(DATE_DASH_REGEX);
    if (!dateMatch) continue;

    const date = dateMatch[0];
    const collected: string[] = [];
    let operationId = "";
    let amountText = "";

    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 8); cursor += 1) {
      const candidate = lines[cursor];
      if (DATE_DASH_REGEX.test(candidate)) break;
      if (!operationId && OPERATION_ID_REGEX.test(candidate)) {
        operationId = candidate;
        continue;
      }
      if (!amountText && MONEY_REGEX.test(candidate)) {
        amountText = candidate.match(MONEY_REGEX)?.[1] ?? "";
        continue;
      }
      if (!["Data", "Descrição", "ID da operação", "Valor", "Saldo", "DETALHE DOS MOVIMENTOS"].includes(candidate)) {
        collected.push(candidate);
      }
    }

    if (!amountText) continue;

    const amount = normalizeMoney(amountText.replace(/^-/, ""));
    if (!Number.isFinite(amount) || amount === 0) continue;

    const description = collected.join(" ").replace(/\s+/g, " ").trim() || "Transação Mercado Pago";
    const isDebit = amountText.trim().startsWith("-");

    transactions.push({
      transactionDate: date,
      accountingDate: date,
      bankType: operationId ? `Mercado Pago ${operationId}` : "Mercado Pago",
      originalDescription: description,
      amount: amount.toFixed(2),
      transactionType: isDebit ? "debit" : "credit",
    });
  }

  return dedupeTransactions(transactions);
}

function dedupeTransactions(transactions: ParsedTransaction[]): ParsedTransaction[] {
  const seen = new Set<string>();
  return transactions.filter((transaction) => {
    const key = [
      transaction.transactionDate,
      transaction.accountingDate,
      transaction.bankType,
      transaction.originalDescription,
      transaction.amount,
      transaction.transactionType,
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseExtractText(text: string): ParsedTransaction[] {
  const tabular = parseTabularExtract(text);
  if (tabular.length > 0) return dedupeTransactions(tabular);

  const mercadoPago = parseMercadoPagoExtract(text);
  if (mercadoPago.length > 0) return mercadoPago;

  return [];
}

export async function extractPdfText(buffer: Buffer, password?: string): Promise<string> {
  const options: any = {
    verbosity: 0,
    data: new Uint8Array(buffer),
    password: password || undefined,
  };

  const parser = new PDFParse(options);
  await (parser as any).load();
  const result = await (parser as any).getText();

  if (result && typeof result === "object" && "pages" in result) {
    return (result as any).pages.map((page: any) => page.text).join("\n");
  }
  if (typeof result === "string") {
    return result;
  }
  return JSON.stringify(result);
}

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

      const suffix = crypto.randomBytes(4).toString("hex");
      const fileKey = `bank-statements/${periodYear}-${String(periodMonth).padStart(2, "0")}/${file.originalname.replace(/\s+/g, "_")}-${suffix}.pdf`;
      const { url: fileUrl } = await storagePut(fileKey, file.buffer, "application/pdf");

      let parsedTransactions: ParsedTransaction[] = [];
      try {
        const text = await extractPdfText(file.buffer, pdfPassword);
        parsedTransactions = autoIdentifyTransactions(parseExtractText(text), bankName, text);
      } catch (parseError: any) {
        console.error("PDF parse error:", parseError);
        const errMsg = String(parseError?.message || "").toLowerCase();
        if (errMsg.includes("password") || errMsg.includes("encrypted") || errMsg.includes("need a password")) {
          return res.status(400).json({
            error: "O PDF é protegido por senha. Informe a senha correta no campo 'Senha do PDF'.",
            needsPassword: true,
          });
        }
        return res.status(400).json({
          error: "Não foi possível interpretar o PDF enviado. Verifique se o arquivo é um extrato válido do banco/carteira e tente novamente.",
        });
      }

      const identifiedCount = parsedTransactions.filter((transaction) => transaction.isIdentified === 1).length;

      const { id: statementId } = await createBankStatement({
        cnpjId,
        bankName,
        periodMonth,
        periodYear,
        fileName: file.originalname,
        fileKey,
        fileUrl,
        totalTransactions: parsedTransactions.length,
        totalIdentified: identifiedCount,
        status: parsedTransactions.length > 0 ? (identifiedCount >= parsedTransactions.length ? "completed" : identifiedCount > 0 ? "partial" : "pending") : "pending",
      });

      if (parsedTransactions.length > 0) {
        await createBankTransactions(
          parsedTransactions.map((transaction) => ({
            statementId,
            transactionDate: normalizeDate(transaction.transactionDate),
            accountingDate: transaction.accountingDate ? normalizeDate(transaction.accountingDate) : null,
            bankType: transaction.bankType || null,
            originalDescription: transaction.originalDescription,
            amount: transaction.amount,
            transactionType: transaction.transactionType,
            category: transaction.category || null,
            userDescription: transaction.userDescription || null,
            notes: transaction.notes || null,
            isIdentified: transaction.isIdentified ?? 0,
          }))
        );
      }

      await recalcStatementCounts(statementId);

      return res.json({
        success: true,
        statementId,
        totalTransactions: parsedTransactions.length,
        autoIdentifiedTransactions: identifiedCount,
        fileUrl,
      });
    } catch (error: any) {
      console.error("Bank statement upload error:", error);
      return res.status(500).json({ error: error.message || "Erro ao processar extrato." });
    }
  });
}
