import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Products page labels", () => {
  it("explicita separadamente os modos de custo e revenda", () => {
    const filePath = path.resolve(__dirname, "Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("Tabela exibida");
    expect(source).toContain("value={priceView}");
    expect(source).toContain('value="cost"');
    expect(source).toContain('value="resale"');
    expect(source).toContain("Tabela de custo Mondial");
    expect(source).toContain("Tabela de revenda");
  });

  it("mantém a experiência responsiva em cartões no mobile e tabela nas telas largas", () => {
    const filePath = path.resolve(__dirname, "Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("lg:hidden");
    expect(source).toContain("max-w-full overflow-x-scroll overflow-y-hidden");
    expect(source).toContain("Arraste a barra horizontal inferior para o lado e veja todas as colunas da tabela.");
    expect(source).toContain("Em telas pequenas, cada produto aparece em cartão para facilitar a leitura.");
  });

  it("preserva a listagem de SKUs e alterna o rótulo do preço principal conforme o filtro", () => {
    const filePath = path.resolve(__dirname, "Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("visibleProducts.map(product => {");
    expect(source).toContain("SKU {product.sku}");
    expect(source).toContain("priceView === \"cost\"");
    expect(source).toContain("priceView === \"cost\" ? \"Valor Mondial\" : \"Valor de revenda\"");
  });

  it("continua mostrando erro explícito quando a consulta protegida falha", () => {
    const filePath = path.resolve(__dirname, "Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("const hasQueryError = productsQuery.isError");
    expect(source).toContain("Não consegui carregar os SKUs neste momento.");
    expect(source).toContain("entre novamente no sistema para restaurar a sessão");
  });
});

// TODO de cobertura futura: validar com teste de integração a volta dos SKUs após repovoar a tabela products no banco.
