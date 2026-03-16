import fs from "fs";
import crypto from "crypto";
import XLSX from "xlsx";
import mysql from "mysql2/promise";

const filePath = process.argv[2] || "/home/ubuntu/upload/TabelaCKDistribuidora_V7.xlsx";
const sourceSheetName = "Tabela";

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[sourceSheetName];
if (!sheet) {
  throw new Error(`Aba ${sourceSheetName} não encontrada na planilha.`);
}

const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
const dedupedMap = new Map();
for (const row of rawRows) {
  const sku = String(row["SKU"] ?? "").trim();
  if (!sku) continue;
  dedupedMap.set(sku, row);
}
const rows = Array.from(dedupedMap.values());
const raw = fs.readFileSync(filePath);
const fileHash = crypto.createHash("sha256").update(raw).digest("hex");

const { storagePut } = await import("../server/storage.ts");
const connection = await mysql.createConnection(process.env.DATABASE_URL);

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const uploadKey = `admin-imports/${Date.now()}-${filePath.split("/").pop()}`;
const uploaded = await storagePut(
  uploadKey,
  raw,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
);

const [uploadResult] = await connection.execute(
  `INSERT INTO product_uploads (fileName, originalFileKey, originalFileUrl, fileHash, sourceSheetName, importedRows, uploadedByUserId, createdAt)
   VALUES (?, ?, ?, ?, ?, ?, NULL, NOW())`,
  [filePath.split("/").pop(), uploaded.key, uploaded.url, fileHash, sourceSheetName, rows.length]
);

const uploadId = uploadResult.insertId;

await connection.execute(`DELETE FROM products`);

const insertSql = `INSERT INTO products (uploadId, sku, titulo, tabelaNovaCk, imposto, comissao, valorProduto, precoDesejado, margemDesejada, precoFinal, margemFinal, lucro, isActive, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`;

for (const row of rows) {
  await connection.execute(insertSql, [
    uploadId,
    String(row["SKU"] ?? ""),
    String(row["Título"] ?? ""),
    toNumber(row["Tabela Nova CK"]),
    toNumber(row["Imposto"]),
    toNumber(row["Comissão"], 0.75),
    toNumber(row["Valor Produto"]),
    toNumber(row["Preço Desejado"]),
    row["Margem Desejada"] == null ? null : toNumber(row["Margem Desejada"]),
    toNumber(row["Preço Final"], toNumber(row["Preço Desejado"])),
    toNumber(row["Margem Final"]),
    toNumber(row["Lucro"]),
  ]);
}

const [[countRow]] = await connection.query(`SELECT COUNT(*) AS total FROM products`);
console.log(JSON.stringify({
  uploadId,
  s3Key: uploaded.key,
  s3Url: uploaded.url,
  importedRows: rows.length,
  savedProducts: countRow.total,
  sampleSkus: rows.slice(0, 5).map(row => String(row["SKU"] ?? "")),
}, null, 2));

await connection.end();
