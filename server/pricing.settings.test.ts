import { describe, expect, it } from "vitest";

describe("pricing settings recalculation", () => {
  it("deduz imposto percentual e valor do Everton do preço de revenda", () => {
    const precoRevenda = 100;
    const impostoPercentual = 10;
    const valorEverton = 0.75;

    const valorImposto = precoRevenda * (impostoPercentual / 100);
    const valorMondial = Math.max(precoRevenda - valorImposto - valorEverton, 0);
    const lucro = precoRevenda - valorMondial - valorEverton - valorImposto;
    const margem = valorMondial > 0 ? lucro / valorMondial : 0;

    expect(valorImposto).toBe(10);
    expect(valorMondial).toBe(89.25);
    expect(lucro).toBe(0);
    expect(margem).toBe(0);
  });
});
