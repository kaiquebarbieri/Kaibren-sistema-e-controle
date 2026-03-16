import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createProtectedContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => undefined,
    } as TrpcContext["res"],
  };
}

describe("orders.simulate", () => {
  it("calcula totais e separa corretamente a lista do cliente e da Mondial", async () => {
    const ctx = createProtectedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.orders.simulate({
      items: [
        {
          productId: 10,
          sku: "SKU-001",
          titulo: "Produto A",
          quantidade: 2,
          tabelaNovaCk: "10.0000",
          imposto: "0.1000",
          comissao: "0.7500",
          valorProduto: "12.5000",
          precoDesejado: "18.0000",
          precoFinal: "18.0000",
          margemFinal: "0.440000",
          lucroUnitario: "5.5000",
        },
        {
          productId: 11,
          sku: "SKU-002",
          titulo: "Produto B",
          quantidade: 3,
          tabelaNovaCk: "8.0000",
          imposto: "0.1000",
          comissao: "0.7500",
          valorProduto: "9.2500",
          precoDesejado: "14.5000",
          precoFinal: "14.5000",
          margemFinal: "0.567567",
          lucroUnitario: "5.2500",
        },
      ],
    });

    expect(result.totals).toEqual({
      totalCliente: "79.5000",
      totalMondial: "52.7500",
      totalComissaoEvertonMondial: "3.7500",
      totalLucro: "26.7500",
      margemPedido: "0.507109",
      totalItens: 5,
    });

    expect(result.customerList).toEqual([
      {
        sku: "SKU-001",
        titulo: "Produto A",
        quantidade: 2,
        precoVendaUnitario: "18.0000",
        totalCliente: "36.0000",
      },
      {
        sku: "SKU-002",
        titulo: "Produto B",
        quantidade: 3,
        precoVendaUnitario: "14.5000",
        totalCliente: "43.5000",
      },
    ]);

    expect(result.mondialList).toEqual([
      {
        sku: "SKU-001",
        titulo: "Produto A",
        quantidade: 2,
        valorCompraUnitario: "12.5000",
        totalMondial: "25.0000",
        evertonMondial: "1.5000",
      },
      {
        sku: "SKU-002",
        titulo: "Produto B",
        quantidade: 3,
        valorCompraUnitario: "9.2500",
        totalMondial: "27.7500",
        evertonMondial: "2.2500",
      },
    ]);
  });
});
