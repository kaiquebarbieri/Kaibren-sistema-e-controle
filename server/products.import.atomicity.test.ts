import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("products import atomicity", () => {
  it("mantém a substituição do catálogo protegida por transação", () => {
    const filePath = path.resolve(__dirname, "db.ts");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("transaction");
    expect(source).toContain("tx.delete(products)");
    expect(source).toContain("tx.insert(products).values(items)");
  });

  it("evita apagar o catálogo quando a importação vier sem itens", () => {
    const filePath = path.resolve(__dirname, "db.ts");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).toContain("if (items.length === 0)");
    expect(source).toContain("return { inserted: 0 }");
  });
});
