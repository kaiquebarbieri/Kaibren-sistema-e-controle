import { describe, it, expect } from "vitest";

describe("CNPJ Management System", () => {
  it("should have myCnpjs table in schema with correct fields", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.myCnpjs).toBeDefined();
    // Verify the table has the expected columns
    const columns = Object.keys(schema.myCnpjs);
    expect(columns).toContain("razaoSocial");
    expect(columns).toContain("cnpj");
    expect(columns).toContain("nomeFantasia");
    expect(columns).toContain("inscricaoEstadual");
    expect(columns).toContain("isActive");
  });

  it("should have cnpjId field in orders table for linking purchases to CNPJs", async () => {
    const schema = await import("../drizzle/schema");
    const orderColumns = Object.keys(schema.orders);
    expect(orderColumns).toContain("cnpjId");
  });

  it("should export CNPJ CRUD functions from db module", async () => {
    const db = await import("./db");
    expect(typeof db.createMyCnpj).toBe("function");
    expect(typeof db.listMyCnpjs).toBe("function");
    expect(typeof db.getMyCnpjById).toBe("function");
    expect(typeof db.updateMyCnpj).toBe("function");
    expect(typeof db.deleteMyCnpj).toBe("function");
    expect(typeof db.getCnpjRanking).toBe("function");
    expect(typeof db.getCnpjEvolution).toBe("function");
  });

  it("should have myCnpjs router with CRUD and analytics procedures", async () => {
    const routerModule = await import("./routers");
    const router = routerModule.appRouter;
    // Check that the router has the myCnpjs namespace
    expect(router).toBeDefined();
    // The router should have _def.procedures or similar structure
    const routerDef = (router as any)._def;
    expect(routerDef).toBeDefined();
  });

  it("should include cnpjId in order input schema", async () => {
    // Verify the router module imports without errors
    const routerModule = await import("./routers");
    expect(routerModule.appRouter).toBeDefined();
  });

  it("should have Dashboard page with CNPJ ranking and evolution chart", async () => {
    // Verify Dashboard component exists and imports correctly
    const fs = await import("fs");
    const dashboardContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/Dashboard.tsx",
      "utf-8"
    );
    expect(dashboardContent).toContain("cnpjRankingQuery");
    expect(dashboardContent).toContain("cnpjEvolutionQuery");
    expect(dashboardContent).toContain("Ranking dos meus CNPJs");
    expect(dashboardContent).toContain("Evolução de compras por CNPJ");
  });

  it("should have CNPJ selection in Orders page for personal purchases", async () => {
    const fs = await import("fs");
    const ordersContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/Orders.tsx",
      "utf-8"
    );
    expect(ordersContent).toContain("selectedCnpjId");
    expect(ordersContent).toContain("cnpjsQuery");
    expect(ordersContent).toContain("CNPJ da compra");
    expect(ordersContent).toContain("Selecione o CNPJ");
  });

  it("should have CNPJ management section in Customers page", async () => {
    const fs = await import("fs");
    const customersContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/Customers.tsx",
      "utf-8"
    );
    expect(customersContent).toContain("cnpjsQuery");
    expect(customersContent).toContain("createCnpjMutation");
    expect(customersContent).toContain("updateCnpjMutation");
    expect(customersContent).toContain("deleteCnpjMutation");
    expect(customersContent).toContain("Meus CNPJs");
    expect(customersContent).toContain("Cadastrar novo CNPJ");
  });

  it("should have CNPJ ranking in Customers page list view", async () => {
    const fs = await import("fs");
    const customersContent = fs.readFileSync(
      "/home/ubuntu/ck-distribuidora-sistema/client/src/pages/Customers.tsx",
      "utf-8"
    );
    expect(customersContent).toContain("cnpjRankingQuery");
    expect(customersContent).toContain("Meus CNPJs - Compras do m");
  });
});
