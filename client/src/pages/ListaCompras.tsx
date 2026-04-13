import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  Upload,
  Download,
  Loader2,
  Plus,
  Trash2,
  Send,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Package,
} from "lucide-react";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

/* ─── Constants ──────────────────────────────────────────── */
const GOLD   = "#D4AF37";
const BG     = "#020617";
const CARD   = "#0A0F1E";
const CARD2  = "#0E1525";
const BORDER = "#1E2A3A";

/* ─── Types ──────────────────────────────────────────────── */
type Item = {
  sku: string;
  titulo: string;
  quantidade: number;
  valorProduto: number;
};

/* ─── Parse planilha ─────────────────────────────────────── */
function parseSheet(file: File): Promise<Item[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const items: Item[] = rows
          .filter(r => r["SKU"] || r["sku"] || r["Código"] || r["codigo"])
          .map(r => ({
            sku:          String(r["SKU"] || r["sku"] || r["Código"] || r["codigo"] || ""),
            titulo:       String(r["Título"] || r["titulo"] || r["Nome"] || r["nome"] || r["Produto"] || ""),
            quantidade:   Number(r["Quantidade"] || r["quantidade"] || r["Qtd"] || r["qtd"] || 1),
            valorProduto: Number(r["Valor"] || r["valor"] || r["Preço"] || r["preco"] || r["Custo"] || 0),
          }));

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/* ─── Export planilha Mondial ────────────────────────────── */
function exportMondial(items: Item[]) {
  if (!items.length) { toast.error("Adicione itens antes de exportar."); return; }

  const rows = items.map(item => ({
    "SKU":                 item.sku,
    "Produto":             item.titulo,
    "Qtd":                 item.quantidade,
    "Valor Unit. Mondial": item.valorProduto,
    "Total Mondial":       item.valorProduto * item.quantidade,
    "Comissão Everton":    0.75 * item.quantidade,
  }));

  const total = items.reduce((s, i) => s + i.valorProduto * i.quantidade, 0);
  const totalEverton = items.reduce((s, i) => s + 0.75 * i.quantidade, 0);

  rows.push({ "SKU": "", "Produto": "TOTAL", "Qtd": 0, "Valor Unit. Mondial": 0, "Total Mondial": total, "Comissão Everton": totalEverton } as any);

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedido Mondial");
  XLSX.writeFile(wb, `pedido-mondial-${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success("Planilha Mondial exportada!");
}

/* ─── Export template vazio ──────────────────────────────── */
function downloadTemplate() {
  const rows = [
    { SKU: "EX-001", Título: "Botão Timer Air Fryer Mondial AFN-40", Quantidade: 10, Valor: 8.50 },
    { SKU: "EX-002", Título: "Puxador Air Fryer Mondial NAF-03", Quantidade: 5, Valor: 12.00 },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, "modelo-lista-compras.xlsx");
  toast.success("Modelo baixado!");
}

/* ─── Row Component ──────────────────────────────────────── */
function ItemRow({ item, index, onChange, onRemove }: {
  item: Item; index: number;
  onChange: (i: number, field: keyof Item, val: any) => void;
  onRemove: (i: number) => void;
}) {
  const inputStyle = {
    background: "#060d1a",
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    color: "#f1f5f9",
    padding: "6px 10px",
    fontSize: 13,
    width: "100%",
    outline: "none",
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{ borderBottom: `1px solid ${BORDER}` }}
    >
      <td style={{ padding: "10px 8px" }}>
        <input style={inputStyle} value={item.sku}
          onChange={e => onChange(index, "sku", e.target.value)}
          placeholder="SKU-001" />
      </td>
      <td style={{ padding: "10px 8px" }}>
        <input style={{ ...inputStyle }} value={item.titulo}
          onChange={e => onChange(index, "titulo", e.target.value)}
          placeholder="Nome do produto" />
      </td>
      <td style={{ padding: "10px 8px", width: 90 }}>
        <input style={{ ...inputStyle, textAlign: "center" }} type="number" min={1}
          value={item.quantidade}
          onChange={e => onChange(index, "quantidade", Number(e.target.value))} />
      </td>
      <td style={{ padding: "10px 8px", width: 110 }}>
        <input style={{ ...inputStyle, textAlign: "right" }} type="number" step="0.01"
          value={item.valorProduto}
          onChange={e => onChange(index, "valorProduto", Number(e.target.value))}
          placeholder="0,00" />
      </td>
      <td style={{ padding: "10px 8px", width: 110, textAlign: "right", color: GOLD, fontSize: 13, fontWeight: 600 }}>
        R${(item.valorProduto * item.quantidade).toFixed(2)}
      </td>
      <td style={{ padding: "10px 8px", width: 42 }}>
        <button onClick={() => onRemove(index)} style={{
          background: "#2a0a0a", border: `1px solid #7f1d1d33`,
          borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#ef4444",
          display: "flex", alignItems: "center",
        }}>
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
      </td>
    </motion.tr>
  );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function ListaCompras() {
  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sendToWhatsAppMutation = trpc.listaMondial?.sendWhatsApp?.useMutation?.({
    onSuccess: () => toast.success("Lista enviada para o WhatsApp!"),
    onError: () => toast.error("Erro ao enviar. Tente novamente."),
  });

  const total = items.reduce((s, i) => s + i.valorProduto * i.quantidade, 0);
  const totalItens = items.reduce((s, i) => s + i.quantidade, 0);
  const totalEverton = 0.75 * totalItens;

  function addBlankRow() {
    setItems(prev => [...prev, { sku: "", titulo: "", quantidade: 1, valorProduto: 0 }]);
  }

  function changeItem(i: number, field: keyof Item, val: any) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const parsed = await parseSheet(file);
      if (!parsed.length) {
        toast.error("Nenhum item encontrado. Verifique o modelo da planilha.");
        return;
      }
      setItems(parsed);
      toast.success(`${parsed.length} itens importados!`);
    } catch (err) {
      toast.error("Erro ao ler a planilha. Use o modelo padrão.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function buildWhatsAppText() {
    const lines = [
      `*🛒 Lista de Compras Mondial — Kaibren*`,
      `📅 ${new Date().toLocaleDateString("pt-BR")}`,
      ``,
      ...items.map(i => `• ${i.sku} | ${i.titulo} | *${i.quantidade} un* | R$${(i.valorProduto * i.quantidade).toFixed(2)}`),
      ``,
      `*Total: R$${total.toFixed(2)}*`,
      `Total itens: ${totalItens} un`,
      `Comissão Everton: R$${totalEverton.toFixed(2)}`,
    ];
    return lines.join("\n");
  }

  function sendWhatsApp() {
    if (!items.length) { toast.error("Adicione itens antes de enviar."); return; }
    const text = encodeURIComponent(buildWhatsAppText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  const tableHeaderStyle = {
    padding: "10px 8px",
    color: "#475569",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: `1px solid ${BORDER}`,
    textAlign: "left" as const,
  };

  return (
    <DashboardLayout activeSection="lista-compras">
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .gold-shimmer {
          background: linear-gradient(90deg, ${GOLD}, #ffe98a, ${GOLD});
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
        input:focus { border-color: ${GOLD}66 !important; box-shadow: 0 0 0 2px ${GOLD}15; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>

      <div className="flex flex-col gap-5" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "#0f1a06", border: `1px solid #4ade8044`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ShoppingBag style={{ width: 22, height: 22, color: "#4ade80" }} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold gold-shimmer">Lista de Compras Mondial</h1>
              <p style={{ fontSize: 13, color: "#475569" }}>
                {items.length} produto(s) · {totalItens} unidades · R${total.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadTemplate} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: CARD2, border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: "7px 12px",
              fontSize: 12, color: "#64748b", cursor: "pointer",
            }}>
              <FileSpreadsheet style={{ width: 13, height: 13 }} />
              Modelo
            </button>

            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#06131a", border: `1px solid #38bdf844`,
              borderRadius: 8, padding: "7px 12px",
              fontSize: 12, fontWeight: 600, color: "#38bdf8", cursor: "pointer",
            }}>
              {uploading ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Upload style={{ width: 13, height: 13 }} />}
              Importar Planilha
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileUpload} />

            <button onClick={sendWhatsApp} disabled={!items.length} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#0a1a0a", border: `1px solid #22c55e44`,
              borderRadius: 8, padding: "7px 12px",
              fontSize: 12, fontWeight: 600, color: "#22c55e", cursor: "pointer",
              opacity: items.length ? 1 : 0.4,
            }}>
              <Send style={{ width: 13, height: 13 }} />
              Enviar WhatsApp
            </button>

            <button onClick={() => exportMondial(items)} disabled={!items.length} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: GOLD + "15", border: `1px solid ${GOLD}44`,
              borderRadius: 8, padding: "7px 14px",
              fontSize: 12, fontWeight: 600, color: GOLD, cursor: "pointer",
              opacity: items.length ? 1 : 0.4,
            }}>
              <Download style={{ width: 13, height: 13 }} />
              Exportar Mondial
            </button>
          </div>
        </motion.div>

        {/* Summary cards */}
        {items.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Produtos",    value: items.length,           color: "#38bdf8", icon: Package },
              { label: "Unidades",   value: totalItens,              color: "#4ade80", icon: ShoppingBag },
              { label: "Total Mondial", value: `R$${total.toFixed(2)}`, color: GOLD, icon: Download },
              { label: "Comissão Everton", value: `R$${totalEverton.toFixed(2)}`, color: "#f97316", icon: CheckCircle2 },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon style={{ width: 13, height: 13, color }} />
                  <span style={{ fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</span>
                </div>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9" }}>{value}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Table */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Itens da lista</span>
            <button onClick={addBlankRow} style={{
              display: "flex", alignItems: "center", gap: 5,
              background: GOLD + "15", border: `1px solid ${GOLD}44`,
              borderRadius: 7, padding: "5px 10px",
              fontSize: 12, fontWeight: 600, color: GOLD, cursor: "pointer",
            }}>
              <Plus style={{ width: 13, height: 13 }} />
              Adicionar item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ShoppingBag style={{ width: 40, height: 40, color: "#1e2a3a" }} />
              <p style={{ color: "#475569", fontSize: 14 }}>Nenhum item ainda</p>
              <p style={{ color: "#334155", fontSize: 12 }}>Importe uma planilha ou adicione itens manualmente</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>SKU</th>
                    <th style={tableHeaderStyle}>Produto</th>
                    <th style={{ ...tableHeaderStyle, textAlign: "center" }}>Qtd</th>
                    <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Valor Unit.</th>
                    <th style={{ ...tableHeaderStyle, textAlign: "right" }}>Total</th>
                    <th style={{ ...tableHeaderStyle }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <ItemRow key={i} item={item} index={i} onChange={changeItem} onRemove={removeItem} />
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${BORDER}` }}>
                    <td colSpan={3} style={{ padding: "12px 8px", color: "#64748b", fontSize: 12 }}>
                      {totalItens} unidades totais
                    </td>
                    <td style={{ padding: "12px 8px", textAlign: "right", color: "#94a3b8", fontSize: 12 }}>Total:</td>
                    <td style={{ padding: "12px 8px", textAlign: "right", color: GOLD, fontWeight: 700, fontSize: 15 }}>
                      R${total.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={4} style={{ padding: "4px 8px 12px", color: "#475569", fontSize: 12 }}>
                      Comissão Everton (R$0,75/un):
                    </td>
                    <td style={{ padding: "4px 8px 12px", textAlign: "right", color: "#f97316", fontWeight: 600, fontSize: 13 }}>
                      R${totalEverton.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Instructions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          style={{ background: "#06131a", border: `1px solid #38bdf822`, borderRadius: 12, padding: "14px 18px" }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle style={{ width: 14, height: 14, color: "#38bdf8" }} />
            <span style={{ color: "#38bdf8", fontSize: 12, fontWeight: 600 }}>Como usar</span>
          </div>
          <ul style={{ color: "#64748b", fontSize: 12, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
            <li>Baixe o <strong style={{ color: "#94a3b8" }}>Modelo</strong> para ver o formato correto da planilha</li>
            <li>Preencha com SKU, nome, quantidade e valor unitário de cada peça</li>
            <li>Clique em <strong style={{ color: "#94a3b8" }}>Importar Planilha</strong> para carregar a lista</li>
            <li>Ajuste os itens se necessário e clique em <strong style={{ color: "#22c55e" }}>Enviar WhatsApp</strong> para mandar direto para a Mondial</li>
            <li>Ou <strong style={{ color: GOLD }}>Exportar Mondial</strong> para baixar a planilha formatada para envio</li>
          </ul>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
