import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext() {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function makeItem(overrides: Partial<{
  sku: string;
  titulo: string;
  quantidade: number;
  valorProduto: string;
  precoFinal: string;
  imposto: string;
  comissao: string;
}> = {}) {
  return {
    productId: null,
    sku: overrides.sku ?? "SKU-001",
    titulo: overrides.titulo ?? "Produto Teste",
    quantidade: overrides.quantidade ?? 1,
    tabelaNovaCk: "10.0000",
    imposto: overrides.imposto ?? "0.3920",
    comissao: overrides.comissao ?? "0.7500",
    valorProduto: overrides.valorProduto ?? "5.0000",
    precoDesejado: overrides.precoFinal ?? "10.0000",
    precoFinal: overrides.precoFinal ?? "10.0000",
    margemFinal: "0.500000",
    lucroUnitario: "3.8580",
  };
}

describe("orders.simulate", () => {
  it("calculates customer order totals correctly", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.orders.simulate({
      orderType: "customer",
      items: [
        makeItem({ quantidade: 10, valorProduto: "5.0000", precoFinal: "10.0000", imposto: "0.3920", comissao: "0.7500" }),
      ],
    });

    // Total cliente = 10 * 10 = 100
    expect(Number(result.totals.totalCliente)).toBeCloseTo(100, 4);
    // Total mondial = 10 * 5 = 50
    expect(Number(result.totals.totalMondial)).toBeCloseTo(50, 4);
    // Total everton = 0.75 * 10 = 7.5
    expect(Number(result.totals.totalComissaoEvertonMondial)).toBeCloseTo(7.5, 4);
    // Total imposto = 0.392 * 10 = 3.92
    expect(Number(result.totals.totalImposto)).toBeCloseTo(3.92, 4);
    // Lucro = 100 - 50 - 3.92 - 7.5 = 38.58
    expect(Number(result.totals.totalLucro)).toBeCloseTo(38.58, 4);
    // Total itens = 10
    expect(result.totals.totalItens).toBe(10);
    // Customer list should have items
    expect(result.customerList.length).toBe(1);
    // Mondial list should have items
    expect(result.mondialList.length).toBe(1);
  });

  it("calculates personal order totals correctly (no tax, no profit)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.orders.simulate({
      orderType: "personal",
      items: [
        makeItem({ quantidade: 5, valorProduto: "8.0000", precoFinal: "12.0000", imposto: "0.5000", comissao: "0.7500" }),
      ],
    });

    // Total mondial = 5 * 8 = 40
    expect(Number(result.totals.totalMondial)).toBeCloseTo(40, 4);
    // Total everton = 0.75 * 5 = 3.75
    expect(Number(result.totals.totalComissaoEvertonMondial)).toBeCloseTo(3.75, 4);
    // Personal: no client total, no tax, no profit
    expect(Number(result.totals.totalCliente)).toBeCloseTo(0, 4);
    expect(Number(result.totals.totalImposto)).toBeCloseTo(0, 4);
    expect(Number(result.totals.totalLucro)).toBeCloseTo(0, 4);
    // Customer list should be empty for personal orders
    expect(result.customerList.length).toBe(0);
    // Mondial list should have items
    expect(result.mondialList.length).toBe(1);
  });

  it("handles multiple items in the same order", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.orders.simulate({
      orderType: "customer",
      items: [
        makeItem({ sku: "A", quantidade: 2, valorProduto: "10.0000", precoFinal: "20.0000", imposto: "0.5000" }),
        makeItem({ sku: "B", quantidade: 3, valorProduto: "5.0000", precoFinal: "8.0000", imposto: "0.2000" }),
      ],
    });

    // Item A: venda=40, mondial=20, imposto=1, everton=1.5, lucro=40-20-1-1.5=17.5
    // Item B: venda=24, mondial=15, imposto=0.6, everton=2.25, lucro=24-15-0.6-2.25=6.15
    // Total venda = 64, total mondial = 35, total imposto = 1.6, total everton = 3.75
    // Total lucro = 17.5 + 6.15 = 23.65
    expect(Number(result.totals.totalCliente)).toBeCloseTo(64, 4);
    expect(Number(result.totals.totalMondial)).toBeCloseTo(35, 4);
    expect(Number(result.totals.totalImposto)).toBeCloseTo(1.6, 4);
    expect(Number(result.totals.totalComissaoEvertonMondial)).toBeCloseTo(3.75, 4);
    expect(Number(result.totals.totalLucro)).toBeCloseTo(23.65, 4);
    expect(result.totals.totalItens).toBe(5);
    expect(result.customerList.length).toBe(2);
    expect(result.mondialList.length).toBe(2);
  });

  it("returns zero margin when no client total", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.orders.simulate({
      orderType: "personal",
      items: [
        makeItem({ quantidade: 1, valorProduto: "10.0000" }),
      ],
    });

    expect(Number(result.totals.margemPedido)).toBeCloseTo(0, 6);
  });
});
