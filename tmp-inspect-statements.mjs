import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);
const [rows] = await connection.query(`
  SELECT id, bank_name AS bankName, period_year AS periodYear, period_month AS periodMonth, cnpj_id AS cnpjId, file_name AS fileName, created_at AS createdAt
  FROM bank_statements
  ORDER BY period_year DESC, period_month DESC, created_at DESC
`);
console.log(JSON.stringify(rows, null, 2));
await connection.end();
