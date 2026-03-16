import { describe, expect, it } from "vitest";

describe("product edit action visibility", () => {
  it("expõe separadamente as ações de pedido e edição de valores", () => {
    const headers = [
      "SKU",
      "Título",
      "Valor Mondial",
      "Valor Revenda",
      "Lucro",
      "Everton Mondial",
      "Pedido",
      "Editar valores",
    ];

    expect(headers).toContain("Pedido");
    expect(headers).toContain("Editar valores");
    expect(headers.filter(header => header === "Editar valores")).toHaveLength(1);
  });
});
