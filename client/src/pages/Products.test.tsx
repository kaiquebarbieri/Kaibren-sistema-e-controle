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
});
