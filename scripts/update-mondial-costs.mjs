import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const dataPath = "/home/ubuntu/ck-distribuidora-sistema/.tmp_mondial_costs.json";

const records = JSON.parse(await fs.readFile(dataPath, "utf8"));
const connection = await mysql.createConnection(process.env.DATABASE_URL);

let updated = 0;
let missing = [];

for (const record of records) {
  const sku = String(record.SKU ?? "").trim();
  const valor = Number(record["Preço de Compra"]);

  if (!sku || Number.isNaN(valor)) continue;

  const [result] = await connection.execute(
    `UPDATE products
     SET valorProduto = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE sku = ?`,
    [valor, sku]
  );

  if (result.affectedRows > 0) {
    updated += Number(result.affectedRows);
  } else {
    missing.push(sku);
  }
}

await connection.end();

console.log(JSON.stringify({ updated, missingCount: missing.length, missing }, null, 2));
