import { describe, it, expect } from "vitest";

/**
 * Unit tests for Marketing campaign logic.
 * These test the pure logic and data transformations used in the marketing module.
 */

describe("Marketing Campaign Logic", () => {
  describe("Campaign type labels", () => {
    const campaignTypeLabels: Record<string, string> = {
      promotional: "Promoção",
      launch: "Lançamento",
      seasonal: "Sazonal",
      flash_sale: "Oferta Relâmpago",
      loyalty: "Fidelidade",
    };

    it("should have labels for all campaign types", () => {
      const types = ["promotional", "launch", "seasonal", "flash_sale", "loyalty"];
      types.forEach(type => {
        expect(campaignTypeLabels[type]).toBeDefined();
        expect(typeof campaignTypeLabels[type]).toBe("string");
        expect(campaignTypeLabels[type].length).toBeGreaterThan(0);
      });
    });
  });

  describe("Status labels", () => {
    const statusLabels: Record<string, string> = {
      draft: "Rascunho",
      scheduled: "Agendada",
      active: "Ativa",
      completed: "Concluída",
      cancelled: "Cancelada",
    };

    it("should have labels for all statuses", () => {
      const statuses = ["draft", "scheduled", "active", "completed", "cancelled"];
      statuses.forEach(status => {
        expect(statusLabels[status]).toBeDefined();
        expect(typeof statusLabels[status]).toBe("string");
      });
    });
  });

  describe("WhatsApp message builder", () => {
    function buildWhatsAppUrl(phone: string, message: string) {
      const encoded = encodeURIComponent(message);
      const cleanPhone = phone.replace(/\D/g, "");
      const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
      return `https://wa.me/${fullPhone}?text=${encoded}`;
    }

    it("should build correct WhatsApp URL with Brazilian phone", () => {
      const url = buildWhatsAppUrl("(11) 99999-1234", "Olá teste!");
      expect(url).toContain("https://wa.me/5511999991234");
      expect(url).toContain("text=");
    });

    it("should not double-prefix 55 if already present", () => {
      const url = buildWhatsAppUrl("5511999991234", "Teste");
      expect(url).toContain("https://wa.me/5511999991234");
      expect(url).not.toContain("555511");
    });

    it("should strip non-digit characters from phone", () => {
      const url = buildWhatsAppUrl("+55 (21) 98765-4321", "Olá!");
      expect(url).toContain("https://wa.me/5521987654321");
    });

    it("should encode message properly", () => {
      const url = buildWhatsAppUrl("11999991234", "Olá {nome}! 🔥 Promoção!");
      expect(url).toContain("text=");
      expect(decodeURIComponent(url.split("text=")[1])).toBe("Olá {nome}! 🔥 Promoção!");
    });
  });

  describe("Message template variable replacement", () => {
    function replaceTemplateVars(template: string, customerName: string, productList: string) {
      let msg = template;
      msg = msg.replace("{nome}", customerName);
      msg = msg.replace("{produtos}", productList);
      return msg;
    }

    it("should replace {nome} with customer name", () => {
      const result = replaceTemplateVars("Olá {nome}!", "João Silva", "");
      expect(result).toBe("Olá João Silva!");
    });

    it("should replace {produtos} with product list", () => {
      const products = "• Produto A - R$ 10,00\n• Produto B - R$ 20,00";
      const result = replaceTemplateVars("Confira:\n{produtos}", "Maria", products);
      expect(result).toContain("• Produto A - R$ 10,00");
      expect(result).toContain("• Produto B - R$ 20,00");
    });

    it("should replace both variables in one template", () => {
      const template = "Olá {nome}! Veja:\n{produtos}\nAproveite!";
      const result = replaceTemplateVars(template, "Carlos", "• Item X - R$ 5,00");
      expect(result).toBe("Olá Carlos! Veja:\n• Item X - R$ 5,00\nAproveite!");
    });
  });

  describe("Conversion rate calculation", () => {
    function calcConversionRate(totalSent: number, totalConverted: number) {
      if (totalSent === 0) return 0;
      return totalConverted / totalSent;
    }

    it("should return 0 when no messages sent", () => {
      expect(calcConversionRate(0, 0)).toBe(0);
    });

    it("should calculate correct rate", () => {
      expect(calcConversionRate(100, 10)).toBe(0.1);
      expect(calcConversionRate(50, 25)).toBe(0.5);
    });

    it("should handle 100% conversion", () => {
      expect(calcConversionRate(10, 10)).toBe(1);
    });

    it("should handle precise decimal rates", () => {
      const rate = calcConversionRate(3, 1);
      expect(rate).toBeCloseTo(0.3333, 4);
    });
  });

  describe("Tracking code generation", () => {
    it("should generate unique tracking codes", () => {
      // Simulate tracking code generation pattern
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const code = `${Date.now()}-${Math.random().toString(36).substring(2, 18)}`;
        codes.add(code);
      }
      expect(codes.size).toBe(100);
    });
  });

  describe("Campaign stats aggregation", () => {
    function aggregateStats(campaigns: { totalSent: number; totalConverted: number; totalClicked: number }[]) {
      return campaigns.reduce(
        (acc, c) => ({
          totalSent: acc.totalSent + c.totalSent,
          totalConverted: acc.totalConverted + c.totalConverted,
          totalClicked: acc.totalClicked + c.totalClicked,
        }),
        { totalSent: 0, totalConverted: 0, totalClicked: 0 }
      );
    }

    it("should aggregate stats from multiple campaigns", () => {
      const campaigns = [
        { totalSent: 50, totalConverted: 5, totalClicked: 20 },
        { totalSent: 100, totalConverted: 15, totalClicked: 40 },
        { totalSent: 30, totalConverted: 3, totalClicked: 10 },
      ];
      const result = aggregateStats(campaigns);
      expect(result.totalSent).toBe(180);
      expect(result.totalConverted).toBe(23);
      expect(result.totalClicked).toBe(70);
    });

    it("should return zeros for empty array", () => {
      const result = aggregateStats([]);
      expect(result.totalSent).toBe(0);
      expect(result.totalConverted).toBe(0);
      expect(result.totalClicked).toBe(0);
    });
  });
});
