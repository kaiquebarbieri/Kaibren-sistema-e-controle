import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Loader2,
  TrendingUp,
  Package,
  DollarSign,
  ShoppingCart,
  Scale,
  Megaphone,
  RefreshCw,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useRef, useState } from "react";
import jsPDF from "jspdf";

/* ─── Constants ──────────────────────────────────────────── */

const GOLD   = "#D4AF37";
const BG     = "#020617";
const CARD   = "#0A0F1E";
const CARD2  = "#0E1525";
const BORDER = "#1E2A3A";

const AGENT_COLORS: Record<string, string> = {
  sam:   "#4ade80",
  bia:   "#f97316",
  leo:   "#34d399",
  maya:  "#60a5fa",
  rex:   "#facc15",
  noah:  GOLD,
};

const AGENT_ICONS: Record<string, React.ElementType> = {
  sam:   ShoppingCart,
  bia:   Package,
  leo:   DollarSign,
  maya:  Megaphone,
  rex:   Scale,
  noah:  TrendingUp,
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" },
  }),
};

/* ─── PDF Generator ──────────────────────────────────────── */

function generatePDF(report: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Header
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 0, W, 40, "F");

  doc.setTextColor(212, 175, 55); // gold
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Kaibren — Relatório de Agente", margin, 18);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, 26);
  doc.text(`Agente: ${report.agentEmoji} ${report.agentName}`, margin, 32);

  y = 52;

  // Title
  doc.setTextColor(241, 245, 249);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(report.title, margin, y);
  y += 10;

  // Divider
  doc.setDrawColor(30, 42, 58);
  doc.line(margin, y, W - margin, y);
  y += 8;

  // Content
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const lines = doc.splitTextToSize(report.content, W - margin * 2);
  lines.forEach((line: string) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    // Highlight bullet lines
    if (line.trim().startsWith("•")) {
      doc.setTextColor(212, 175, 55);
    } else if (line.includes(":") && !line.startsWith(" ")) {
      doc.setTextColor(241, 245, 249);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(203, 213, 225);
      doc.setFont("helvetica", "normal");
    }
    doc.text(line, margin, y);
    y += 5.5;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 285, W, 15, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.text(`Kaibren © ${new Date().getFullYear()} — Página ${i}/${pageCount}`, margin, 292);
    doc.text("Confidencial — uso interno", W - margin - 40, 292);
  }

  const filename = `kaibren-${report.agentSlug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/* ─── Report Card ────────────────────────────────────────── */

function ReportCard({ report, i }: { report: any; i: number }) {
  const [expanded, setExpanded] = useState(false);
  const color = AGENT_COLORS[report.agentSlug] ?? "#94a3b8";
  const Icon  = AGENT_ICONS[report.agentSlug] ?? FileText;

  const date = new Date(report.createdAt);
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.div
      custom={i}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      style={{
        background: CARD,
        border: `1px solid ${report.isRead ? BORDER : color + "44"}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Left accent */}
      <div style={{
        display: "flex",
        position: "relative",
      }}>
        <div style={{
          width: 3, background: color, opacity: 0.8, flexShrink: 0,
        }} />

        <div style={{ flex: 1, padding: "16px 18px" }}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: color + "15",
                border: `1px solid ${color}33`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon style={{ width: 18, height: 18, color }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>
                    {report.agentEmoji} {report.agentName}
                  </span>
                  {!report.isRead && (
                    <span style={{
                      fontSize: 10, fontWeight: 600, color, background: color + "20",
                      border: `1px solid ${color}40`, borderRadius: 20, padding: "1px 7px",
                    }}>
                      Novo
                    </span>
                  )}
                </div>
                <p style={{ color, fontSize: 13, fontWeight: 600, marginTop: 2 }}>
                  {report.title}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1" style={{ color: "#475569", fontSize: 11 }}>
                <Calendar style={{ width: 11, height: 11 }} />
                {dateStr} {timeStr}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: BORDER, margin: "12px 0" }} />

          {/* Content preview */}
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: "#94a3b8",
            whiteSpace: "pre-line",
            lineHeight: 1.7,
            maxHeight: expanded ? "none" : "72px",
            overflow: "hidden",
            position: "relative",
          }}>
            {report.content}
            {!expanded && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                height: 30,
                background: `linear-gradient(transparent, ${CARD})`,
              }} />
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                fontSize: 12, color: "#475569",
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              <ChevronRight
                style={{
                  width: 14, height: 14,
                  transform: expanded ? "rotate(90deg)" : "none",
                  transition: "transform 0.2s",
                }}
              />
              {expanded ? "Recolher" : "Ver completo"}
            </button>

            <button
              onClick={() => generatePDF(report)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: GOLD + "15",
                border: `1px solid ${GOLD}44`,
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12, fontWeight: 600, color: GOLD,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = GOLD + "25")}
              onMouseLeave={e => (e.currentTarget.style.background = GOLD + "15")}
            >
              <Download style={{ width: 13, height: 13 }} />
              Baixar PDF
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── All Reports PDF ────────────────────────────────────── */

function downloadAllPDF(reports: any[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;
  let firstPage = true;

  for (const report of reports) {
    if (!firstPage) {
      doc.addPage();
      y = margin;
    }
    firstPage = false;

    // Agent header
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, W, 35, "F");
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(`${report.agentEmoji} ${report.agentName}`, margin, 15);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(report.title, margin, 23);
    doc.text(new Date(report.createdAt).toLocaleString("pt-BR"), margin, 30);
    y = 45;

    doc.setDrawColor(30, 42, 58);
    doc.line(margin, y - 2, W - margin, y - 2);

    const lines = doc.splitTextToSize(report.content, W - margin * 2);
    doc.setFontSize(10);
    for (const line of lines) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(line.startsWith("•") ? 212 : 203, line.startsWith("•") ? 175 : 213, line.startsWith("•") ? 55 : 225);
      doc.text(line, margin, y);
      y += 5.5;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 285, W, 15, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.text(`Kaibren — Relatório Consolidado | Página ${i}/${pageCount}`, margin, 292);
    doc.text(new Date().toLocaleDateString("pt-BR"), W - margin - 20, 292);
  }

  doc.save(`kaibren-relatorio-consolidado-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/* ─── Page ───────────────────────────────────────────────── */

export default function Relatorios() {
  const { data: reports, isLoading, refetch, isFetching } = trpc.agentes.reports.useQuery();

  const sorted = [...(reports ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const unread = sorted.filter(r => !r.isRead).length;

  return (
    <DashboardLayout activeSection="relatorios">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .gold-shimmer {
          background: linear-gradient(90deg, ${GOLD}, #ffe98a, ${GOLD});
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      <div className="flex flex-col gap-5" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "#1a1200",
              border: `1px solid ${GOLD}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FileText style={{ width: 22, height: 22, color: GOLD }} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold gold-shimmer">Relatórios</h1>
              <p style={{ fontSize: 13, color: "#475569" }}>
                {sorted.length} relatório(s)
                {unread > 0 && <span style={{ color: GOLD }}> · {unread} novo(s)</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: CARD2, border: `1px solid ${BORDER}`,
                borderRadius: 8, padding: "7px 12px",
                fontSize: 12, color: "#94a3b8", cursor: "pointer",
              }}
            >
              <RefreshCw style={{
                width: 13, height: 13,
                animation: isFetching ? "spin 1s linear infinite" : "none",
              }} />
              Atualizar
            </button>

            {sorted.length > 0 && (
              <button
                onClick={() => downloadAllPDF(sorted)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: GOLD + "15",
                  border: `1px solid ${GOLD}44`,
                  borderRadius: 8, padding: "7px 14px",
                  fontSize: 12, fontWeight: 600, color: GOLD, cursor: "pointer",
                }}
              >
                <Download style={{ width: 13, height: 13 }} />
                PDF Consolidado
              </button>
            )}
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 style={{ width: 24, height: 24, color: "#334155" }} className="animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText style={{ width: 40, height: 40, color: "#1e2a3a" }} />
            <p style={{ color: "#475569", fontSize: 14 }}>Nenhum relatório disponível ainda.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((report: any, i: number) => (
              <ReportCard key={report.id} report={report} i={i} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
