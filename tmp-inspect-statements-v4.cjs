const mysql = require('mysql2/promise');
(async () => {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await connection.query(`
    SELECT id, bankName, periodYear, periodMonth, cnpjId, fileName, createdAt
    FROM bank_statements
    ORDER BY periodYear DESC, periodMonth DESC, createdAt DESC
  `);
  console.log(JSON.stringify(rows, null, 2));
  await connection.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
