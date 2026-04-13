/**
 * Shopee Ads — Gerador de Relatório PDF
 */

import PDFDocument from "pdfkit";

interface AdsDashData {
  balance: number | null;
  kpis: {
    expense7d: number;
    expense14d: number;
    directGmv7d: number;
    broadGmv7d: number;
    roas7d: number;
    ctr7d: number;
    cpc7d: number;
    clicks7d: number;
    impressions7d: number;
    directOrders7d: number;
  };
  campaigns: Array<{
    id: number;
    name: string;
    status: string;
    type: string;
    placement: string;
    budget: number;
    roasTarget: number | null;
    itemCount: number;
  }>;
  dailyPerformance: Array<{
    date: string;
    expense: number;
    clicks: number;
    impressions: number;
    directGmv: number;
    directRoas: number;
    ctr: number;
  }>;
  alerts: Array<{ level: string; message: string }>;
  totalCampaigns: number;
  activeCampaigns: number;
  pausedCampaigns: number;
}

function fmt(v: number): string {
  return `R$${v.toFixed(2).replace(".", ",")}`;
}

export function generateAdsPdf(dash: AdsDashData, analysis: string): Buffer {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const pageWidth = doc.page.width - 100; // margins

  // ========== HEADER ==========
  doc.rect(0, 0, doc.page.width, 90).fill("#1a1a2e");

  doc.fill("#F97316").fontSize(22).font("Helvetica-Bold")
    .text("SHOPEE ADS", 50, 25);
  doc.fill("#ffffff").fontSize(10).font("Helvetica")
    .text(`Relatorio de Performance — ${dateStr} ${timeStr}`, 50, 52);
  doc.fill("#aaaaaa").fontSize(9)
    .text("Kaibren — Pecas de Reposicao Mondial", 50, 67);

  doc.fill("#F97316").fontSize(9).font("Helvetica-Bold")
    .text("Sam - Analista de Ads IA", doc.page.width - 220, 25, { width: 170, align: "right" });
  doc.fill("#aaaaaa").fontSize(8).font("Helvetica")
    .text("Gerado automaticamente", doc.page.width - 220, 40, { width: 170, align: "right" });

  let y = 110;

  // ========== KPIs ==========
  doc.fill("#F97316").fontSize(14).font("Helvetica-Bold")
    .text("KPIs — Ultimos 7 dias", 50, y);
  y += 25;

  const kpis = dash.kpis;
  const kpiData = [
    ["Gasto Total", fmt(kpis.expense7d)],
    ["Vendas via Ads", fmt(kpis.directGmv7d)],
    ["ROAS Direto", `${kpis.roas7d}x`],
    ["CPC Medio", fmt(kpis.cpc7d)],
    ["CTR", `${kpis.ctr7d}%`],
    ["Cliques", String(kpis.clicks7d)],
    ["Impressoes", String(kpis.impressions7d)],
    ["Pedidos Ads", String(kpis.directOrders7d)],
  ];

  // KPIs em grid 2x4
  const colWidth = pageWidth / 4;
  kpiData.forEach((kpi, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 50 + col * colWidth;
    const ky = y + row * 45;

    doc.rect(x, ky, colWidth - 8, 38).lineWidth(0.5).strokeColor("#333333").stroke();
    doc.fill("#888888").fontSize(8).font("Helvetica").text(kpi[0], x + 8, ky + 6, { width: colWidth - 16 });
    doc.fill("#ffffff").fontSize(14).font("Helvetica-Bold").text(kpi[1], x + 8, ky + 18, { width: colWidth - 16 });
  });

  y += 100;

  // ========== SALDO ==========
  if (dash.balance != null) {
    doc.rect(50, y, pageWidth, 30).fill("#1a1a2e").stroke();
    doc.fill("#F97316").fontSize(10).font("Helvetica-Bold")
      .text(`Saldo de Creditos Ads: ${fmt(dash.balance)}`, 60, y + 9);
    y += 40;
  }

  // ========== ALERTAS ==========
  if (dash.alerts.length > 0) {
    doc.fill("#F97316").fontSize(12).font("Helvetica-Bold")
      .text("Alertas", 50, y);
    y += 18;

    dash.alerts.forEach((a) => {
      const icon = a.level === "red" ? "[!]" : a.level === "yellow" ? "[*]" : "[OK]";
      const color = a.level === "red" ? "#ef4444" : a.level === "yellow" ? "#eab308" : "#22c55e";
      doc.fill(color).fontSize(9).font("Helvetica-Bold").text(icon, 50, y, { continued: true });
      doc.fill("#cccccc").font("Helvetica").text(` ${a.message}`, { continued: false });
      y += 14;
    });
    y += 10;
  }

  // ========== CAMPANHAS ==========
  doc.fill("#F97316").fontSize(12).font("Helvetica-Bold")
    .text(`Campanhas (${dash.activeCampaigns} ativas / ${dash.totalCampaigns} total)`, 50, y);
  y += 20;

  if (dash.campaigns.length === 0) {
    doc.fill("#888888").fontSize(9).font("Helvetica").text("Nenhuma campanha encontrada", 50, y);
    y += 15;
  } else {
    // Header
    doc.fill("#888888").fontSize(8).font("Helvetica-Bold");
    doc.text("Nome", 50, y, { width: 180 });
    doc.text("Status", 235, y, { width: 60 });
    doc.text("Tipo", 300, y, { width: 50 });
    doc.text("Budget", 355, y, { width: 70 });
    doc.text("ROAS", 430, y, { width: 50 });
    doc.text("Items", 485, y, { width: 40 });
    y += 14;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor("#333333").lineWidth(0.5).stroke();
    y += 6;

    dash.campaigns.forEach((c) => {
      if (y > 750) {
        doc.addPage();
        y = 50;
      }
      const statusColor = c.status === "ongoing" ? "#22c55e" : c.status === "paused" ? "#eab308" : "#888888";
      doc.fill("#dddddd").fontSize(8).font("Helvetica");
      doc.text(c.name.substring(0, 35), 50, y, { width: 180 });
      doc.fill(statusColor).text(c.status === "ongoing" ? "Ativa" : c.status === "paused" ? "Pausada" : c.status, 235, y, { width: 60 });
      doc.fill("#dddddd").text(c.type, 300, y, { width: 50 });
      doc.text(c.budget > 0 ? fmt(c.budget) : "Ilimitado", 355, y, { width: 70 });
      doc.text(c.roasTarget ? `${c.roasTarget}x` : "Auto", 430, y, { width: 50 });
      doc.text(String(c.itemCount), 485, y, { width: 40 });
      y += 14;
    });
    y += 10;
  }

  // ========== PERFORMANCE DIARIA ==========
  if (y > 600) { doc.addPage(); y = 50; }

  doc.fill("#F97316").fontSize(12).font("Helvetica-Bold")
    .text("Performance Diaria (14 dias)", 50, y);
  y += 20;

  // Header
  doc.fill("#888888").fontSize(7).font("Helvetica-Bold");
  doc.text("Data", 50, y, { width: 60 });
  doc.text("Gasto", 115, y, { width: 65 });
  doc.text("Vendas", 185, y, { width: 65 });
  doc.text("ROAS", 255, y, { width: 40 });
  doc.text("Cliques", 300, y, { width: 50 });
  doc.text("Impr.", 355, y, { width: 55 });
  doc.text("CTR", 415, y, { width: 40 });
  y += 12;
  doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor("#333333").lineWidth(0.5).stroke();
  y += 5;

  dash.dailyPerformance.forEach((d) => {
    if (y > 760) { doc.addPage(); y = 50; }
    const roasColor = d.directRoas >= 4 ? "#22c55e" : d.directRoas >= 2 ? "#eab308" : "#ef4444";
    doc.fill("#cccccc").fontSize(7).font("Helvetica");
    doc.text(d.date, 50, y, { width: 60 });
    doc.text(fmt(d.expense), 115, y, { width: 65 });
    doc.fill("#22c55e").text(fmt(d.directGmv), 185, y, { width: 65 });
    doc.fill(roasColor).font("Helvetica-Bold").text(`${d.directRoas}x`, 255, y, { width: 40 });
    doc.fill("#cccccc").font("Helvetica").text(String(d.clicks), 300, y, { width: 50 });
    doc.text(String(d.impressions), 355, y, { width: 55 });
    doc.text(`${d.ctr}%`, 415, y, { width: 40 });
    y += 12;
  });

  // ========== ANALISE IA ==========
  doc.addPage();
  y = 50;

  doc.rect(0, 0, doc.page.width, 60).fill("#1a1a2e");
  doc.fill("#F97316").fontSize(16).font("Helvetica-Bold")
    .text("Analise Estrategica — Sam IA", 50, 18);
  doc.fill("#aaaaaa").fontSize(9).font("Helvetica")
    .text(`Gerada em ${dateStr} as ${timeStr} | Modelo: GPT-4o`, 50, 40);

  y = 75;

  // Parse markdown simples
  const lines = analysis.split("\n");
  for (const line of lines) {
    if (y > 740) { doc.addPage(); y = 50; }

    const trimmed = line.trim();
    if (!trimmed) { y += 6; continue; }

    // Headers
    if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      y += 4;
      doc.fill("#F97316").fontSize(12).font("Helvetica-Bold")
        .text(trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, ""), 50, y, { width: pageWidth });
      y += doc.heightOfString(trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, ""), { width: pageWidth, fontSize: 12 }) + 6;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      y += 6;
      doc.fill("#F97316").fontSize(14).font("Helvetica-Bold")
        .text(trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, ""), 50, y, { width: pageWidth });
      y += doc.heightOfString(trimmed.replace(/^#+\s*/, "").replace(/\*\*/g, ""), { width: pageWidth, fontSize: 14 }) + 8;
      continue;
    }

    // Bold lines (starting with **)
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      doc.fill("#ffffff").fontSize(10).font("Helvetica-Bold")
        .text(trimmed.replace(/\*\*/g, ""), 50, y, { width: pageWidth });
      y += doc.heightOfString(trimmed.replace(/\*\*/g, ""), { width: pageWidth, fontSize: 10 }) + 4;
      continue;
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const text = trimmed.substring(2).replace(/\*\*/g, "");
      doc.fill("#cccccc").fontSize(9).font("Helvetica")
        .text("  •  " + text, 50, y, { width: pageWidth - 10 });
      y += doc.heightOfString("  •  " + text, { width: pageWidth - 10, fontSize: 9 }) + 3;
      continue;
    }

    // Numbered items
    if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/\*\*/g, "");
      doc.fill("#dddddd").fontSize(9).font("Helvetica")
        .text(text, 50, y, { width: pageWidth });
      y += doc.heightOfString(text, { width: pageWidth, fontSize: 9 }) + 3;
      continue;
    }

    // Normal text
    const text = trimmed.replace(/\*\*/g, "");
    doc.fill("#cccccc").fontSize(9).font("Helvetica")
      .text(text, 50, y, { width: pageWidth });
    y += doc.heightOfString(text, { width: pageWidth, fontSize: 9 }) + 3;
  }

  // Footer em todas as paginas
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.fill("#555555").fontSize(7).font("Helvetica")
      .text(
        `Kaibren — Relatorio Shopee Ads — ${dateStr} — Pagina ${i + 1}/${pages.count}`,
        50,
        doc.page.height - 30,
        { width: pageWidth, align: "center" }
      );
  }

  doc.end();

  return Buffer.concat(chunks);
}
