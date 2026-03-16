import { describe, expect, it } from "vitest";

describe("product manual pricing edit calculations", () => {
  it("recalcula lucro e margem a partir do valor pago, valor de venda, imposto e Everton", () => {
    const valorProduto = 100;
    const precoFinal = 150;
    const imposto = 12;
    const comissao = 0.75;

    const lucro = precoFinal - valorProduto - imposto - comissao;
    const margemFinal = valorProduto === 0 ? 0 : lucro / valorProduto;

    expect(lucro).toBe(37.25);
    expect(margemFinal).toBe(0.3725);
  });

  it("mantém margem zero quando o valor pago é zero", () => {
    const valorProduto = 0;
    const precoFinal = 50;
    const imposto = 5;
    const comissao = 0.75;

    const lucro = precoFinal - valorProduto - imposto - comissao;
    const margemFinal = valorProduto === 0 ? 0 : lucro / valorProduto;

    expect(lucro).toBe(44.25);
    expect(margemFinal).toBe(0);
  });
});
