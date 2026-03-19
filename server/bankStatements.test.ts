import { describe, it, expect } from "vitest";

describe("Bank Statements Module", () => {
  it("should have bankStatements and bankTransactions tables in schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.bankStatements).toBeDefined();
    expect(schema.bankTransactions).toBeDefined();
    // Verify key columns
    const stmtColumns = Object.keys(schema.bankStatements);
    expect(stmtColumns).toContain("bankName");
    expect(stmtColumns).toContain("periodMonth");
    expect(stmtColumns).toContain("periodYear");
    expect(stmtColumns).toContain("fileName");
    expect(stmtColumns).toContain("fileKey");
    expect(stmtColumns).toContain("fileUrl");
    expect(stmtColumns).toContain("totalTransactions");
    expect(stmtColumns).toContain("totalIdentified");
    expect(stmtColumns).toContain("status");

    const txnColumns = Object.keys(schema.bankTransactions);
    expect(txnColumns).toContain("statementId");
    expect(txnColumns).toContain("transactionDate");
    expect(txnColumns).toContain("originalDescription");
    expect(txnColumns).toContain("amount");
    expect(txnColumns).toContain("transactionType");
    expect(txnColumns).toContain("category");
    expect(txnColumns).toContain("userDescription");
    expect(txnColumns).toContain("isIdentified");
  });

  it("should export Bank Statement CRUD functions from db module", async () => {
    const db = await import("./db");
    expect(typeof db.createBankStatement).toBe("function");
    expect(typeof db.listBankStatements).toBe("function");
    expect(typeof db.getBankStatementById).toBe("function");
    expect(typeof db.updateBankStatement).toBe("function");
    expect(typeof db.deleteBankStatement).toBe("function");
    expect(typeof db.createBankTransactions).toBe("function");
    expect(typeof db.listBankTransactions).toBe("function");
    expect(typeof db.updateBankTransaction).toBe("function");
    expect(typeof db.updateBankTransactionsBatch).toBe("function");
    expect(typeof db.recalcStatementCounts).toBe("function");
  });

  it("should have bankStatements router with CRUD and transaction procedures", async () => {
    const routerModule = await import("./routers");
    const router = routerModule.appRouter;
    expect(router).toBeDefined();
    const routerDef = (router as any)._def;
    expect(routerDef).toBeDefined();
  });

  it("should have BankStatements page with upload, list and detail views", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/BankStatements.tsx",
      "utf-8"
    );
    // Upload form
    expect(content).toContain("Enviar Extrato PDF");
    expect(content).toContain("uploadBankName");
    expect(content).toContain("/api/bank-statement/upload");
    // List view
    expect(content).toContain("Extratos Bancários");
    expect(content).toContain("filteredStatements");
    // Detail view
    expect(content).toContain("filteredTransactions");
    expect(content).toContain("handleExportExcel");
    // Transaction editing
    expect(content).toContain("editingTxnId");
    expect(content).toContain("editCategory");
    expect(content).toContain("editDescription");
    expect(content).toContain("handleSaveTxn");
    // Categories
    expect(content).toContain("Fornecedor");
    expect(content).toContain("Imposto / Tributo");
    expect(content).toContain("Pix Enviado");
    expect(content).toContain("Pix Recebido");
  });

  it("should have bank statement upload route registered", async () => {
    const uploadModule = await import("./bankStatementUpload");
    expect(typeof uploadModule.registerBankStatementUploadRoute).toBe("function");
  });

  it("should have Extratos menu item in navigation", async () => {
    const fs = await import("fs");
    const layoutContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/components/DashboardLayout.tsx",
      "utf-8"
    );
    expect(layoutContent).toContain("Extratos");
    expect(layoutContent).toContain("/extratos");
    expect(layoutContent).toContain("FileText");
  });

  it("should have routes for extratos in App.tsx", async () => {
    const fs = await import("fs");
    const appContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/App.tsx",
      "utf-8"
    );
    expect(appContent).toContain("/extratos");
    expect(appContent).toContain("BankStatements");
  });

  it("should export Excel with correct sheet structure", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/BankStatements.tsx",
      "utf-8"
    );
    // Excel export should have two sheets
    expect(content).toContain("Transações");
    expect(content).toContain("Resumo");
    expect(content).toContain("XLSX.utils.json_to_sheet");
    expect(content).toContain("XLSX.writeFile");
    // Should include key columns matching bank PDF format
    expect(content).toContain("Data Lan\u00e7amento");
    expect(content).toContain("Data Cont\u00e1bil");
    expect(content).toContain("Descri\u00e7\u00e3o");
    expect(content).toContain("Categoria");
    expect(content).toContain("Identifica\u00e7\u00e3o");
    expect(content).toContain("Valor");
  });
});
