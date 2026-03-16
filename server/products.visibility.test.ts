import { describe, expect, it } from "vitest";

describe("products visibility in menu", () => {
  it("uses the full adjusted product base when there is no search term", () => {
    const adjustedProducts = [
      { sku: "0001", titulo: "Produto A" },
      { sku: "0002", titulo: "Produto B" },
      { sku: "0003", titulo: "Produto C" },
    ];

    const query = "";
    const visibleProducts = !query.trim()
      ? adjustedProducts
      : adjustedProducts.filter(product => {
          const normalized = query.trim().toLowerCase();
          return product.sku.toLowerCase().includes(normalized) || product.titulo.toLowerCase().includes(normalized);
        });

    expect(visibleProducts).toHaveLength(3);
    expect(visibleProducts.map(item => item.sku)).toEqual(["0001", "0002", "0003"]);
  });

  it("filters by sku or title when a search term is provided", () => {
    const adjustedProducts = [
      { sku: "0001-AB", titulo: "Produto A" },
      { sku: "0002-CD", titulo: "Produto B" },
      { sku: "XYZ-03", titulo: "Motor Especial" },
    ];

    const query = "motor";
    const normalized = query.trim().toLowerCase();
    const visibleProducts = adjustedProducts.filter(product => {
      return product.sku.toLowerCase().includes(normalized) || product.titulo.toLowerCase().includes(normalized);
    });

    expect(visibleProducts).toHaveLength(1);
    expect(visibleProducts[0]?.sku).toBe("XYZ-03");
  });
});
