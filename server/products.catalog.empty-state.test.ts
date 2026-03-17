import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("products catalog empty state", () => {
  it("mantém mensagem explícita quando não há SKUs no catálogo", () => {
    const filePath = path.resolve(__dirname, "../client/src/pages/Products.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("Nenhum produto encontrado");
    expect(source).toContain("Restaurar");
  });
});
