import { describe, expect, it } from "vitest";

type ProductRow = {
  id: number;
  sku: string;
  titulo: string;
  tabelaNovaCk: string;
  imposto: string;
  comissao: string;
  valorProduto: string;
  precoDesejado: string;
  precoFinal: string;
  margemFinal: string;
  lucro: string;
};

type CartItem = {
  productId: number | null;
  sku: string;
  titulo: string;
  quantidade: number;
  tabelaNovaCk: string;
  imposto: string;
  comissao: string;
  valorProduto: string;
  precoDesejado: string;
  precoFinal: string;
  margemFinal: string;
  lucroUnitario: string;
};

function addToCart(current: CartItem[], product: ProductRow): CartItem[] {
  const existing = current.find(item => item.sku === product.sku);
  if (existing) {
    return current.map(item =>
      item.sku === product.sku ? { ...item, quantidade: item.quantidade + 1 } : item
    );
  }

  return [
    {
      productId: product.id,
      sku: product.sku,
      titulo: product.titulo,
      quantidade: 1,
      tabelaNovaCk: String(product.tabelaNovaCk),
      imposto: String(product.imposto),
      comissao: String(product.comissao),
      valorProduto: String(product.valorProduto),
      precoDesejado: String(product.precoDesejado),
      precoFinal: String(product.precoFinal),
      margemFinal: String(product.margemFinal),
      lucroUnitario: String(product.lucro),
    },
    ...current,
  ];
}

describe("sku quick entry behavior", () => {
  it("keeps previous products in the list and allows sequential additions through the submit flow", () => {
    const productA: ProductRow = {
      id: 1,
      sku: "1001",
      titulo: "Produto A",
      tabelaNovaCk: "10",
      imposto: "1",
      comissao: "0.75",
      valorProduto: "15",
      precoDesejado: "20",
      precoFinal: "21",
      margemFinal: "0.2",
      lucro: "6",
    };

    const productB: ProductRow = {
      id: 2,
      sku: "1002",
      titulo: "Produto B",
      tabelaNovaCk: "10",
      imposto: "1",
      comissao: "0.75",
      valorProduto: "30",
      precoDesejado: "40",
      precoFinal: "42",
      margemFinal: "0.25",
      lucro: "12",
    };

    let cart: CartItem[] = [];
    cart = addToCart(cart, productA);
    cart = addToCart(cart, productB);
    cart = addToCart(cart, productA);

    expect(cart).toHaveLength(2);
    expect(cart.find(item => item.sku === "1001")?.quantidade).toBe(2);
    expect(cart.find(item => item.sku === "1002")?.quantidade).toBe(1);
  });
});
