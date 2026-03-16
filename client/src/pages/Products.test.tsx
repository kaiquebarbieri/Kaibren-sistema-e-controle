import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Products page labels", () => {
  it("explicita separadamente os valores da Mondial e de venda ao cliente", () => {
    const filePath = path.resolve(__dirname, "Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("Valor Mondial");
    expect(source).toContain("Valor de venda ao cliente");
    expect(source).toContain("Venda ao cliente");
  });

  it("usa cartões no mobile e tabela apenas em telas largas", () => {
    const filePath = path.resolve(__dirname, "Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("lg:hidden");
    expect(source).toContain("hidden overflow-x-auto rounded-2xl border border-border/60 lg:block");
    expect(source).toContain("Em telas pequenas, cada produto aparece em cartão para facilitar a leitura.");
  });

  it("preserva tanto o estado vazio quanto a renderização da listagem de SKUs", () => {
    const filePath = path.resolve(__dirname, "Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("Nenhum produto encontrado para essa busca.");
    expect(source).toContain("visibleProducts.map(product => {");
    expect(source).toContain("SKU {product.sku}");
    expect(source).toContain("{product.sku}");
  });

  it("mostra erro explícito quando a consulta protegida falha, em vez de fingir lista vazia", () => {
    const filePath = path.resolve(__dirname, "Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("const hasQueryError = productsQuery.isError");
    expect(source).toContain("Não consegui carregar os SKUs neste momento.");
    expect(source).toContain("entre novamente no sistema para restaurar a sessão");
  });
});
