import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download,
  FileSpreadsheet,
  Package,
  Search,
  Upload,
  Filter,
  ShoppingCart,
  TrendingDown,
  Layers,
  Tag,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { useRef, useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

/* ════════════════════════════════════
   TIPOS
════════════════════════════════════ */
type Produto = {
  sku: string;
  titulo: string;
  custo: number;   // o que paga
  venda: number;   // o que vende (atacado)
  categoria: string;
  editando?: boolean;
};

/* ════════════════════════════════════
   FAIXAS DE VOLUME (editáveis)
════════════════════════════════════ */
const DEFAULT_FAIXAS = [
  { label: "1–9 un",    desc: "Balcão",  mult: 1.00 },
  { label: "10–24 un",  desc: "-10%",    mult: 0.90 },
  { label: "25–49 un",  desc: "-15%",    mult: 0.85 },
  { label: "50–99 un",  desc: "-20%",    mult: 0.80 },
  { label: "100+ un",   desc: "-25%",    mult: 0.75 },
];

/* ════════════════════════════════════
   COMISSÃO EVERTON (gerente Mondial)
   Regra: custo < R$ 5,00 → R$ 0,40 / custo >= R$ 5,00 → R$ 0,90
════════════════════════════════════ */
function calcEverton(custo: number): number {
  if (custo <= 0) return 0;
  return custo < 5 ? 0.40 : 0.90;
}

/* ════════════════════════════════════
   EMBALAGEM por tipo de produto
   Botão (sem bolha)              → R$ 0,30
   Pequeno c/ bolha (puxador,
     acoplamento)                  → R$ 0,95  (etiqueta 0,15 + saco 0,20 + bolha 0,60)
   Médio (hélice, base)            → R$ 1,00
   Grande c/ caixa (cuba, cesto,
     copo liquidificador, motor)   → R$ 3,45  (etiqueta 0,15 + caixa 2,65 + bolha 0,65)
   Demais categorias retornam null — Kaique precisa confirmar antes de calcular.
════════════════════════════════════ */
type TipoEmbalagem = "botao" | "pequeno" | "medio" | "grande" | null;

function detectTipoEmbalagem(titulo: string): TipoEmbalagem {
  const t = titulo.toLowerCase();
  if (t.includes("botão") || t.includes("botões") || t.includes("botao") || t.includes("botoes") || t.includes("anel") || t.includes("plug")) return "botao";
  if (t.includes("puxador") || t.includes("acoplamento") || t.includes("acoplador") || t.includes("cabo") || t.includes("alça") || t.includes("alca") || t.includes("kit")) return "pequeno";
  if (t.includes("hélice") || t.includes("helice") || t.includes("base") || t.includes("resistência") || t.includes("resistencia") || t.includes("caixa")) return "medio";
  if (t.includes("cuba") || t.includes("cesto") || t.includes("copo") || t.includes("motor") || t.includes("comedouro")) return "grande";
  return null;
}

function calcEmbalagem(titulo: string): number | null {
  const tipo = detectTipoEmbalagem(titulo);
  if (tipo === "botao") return 0.30;
  if (tipo === "pequeno") return 0.95;
  if (tipo === "medio") return 1.00;
  if (tipo === "grande") return 3.45;
  return null;
}

/* ════════════════════════════════════
   DETECTOR DE CATEGORIA
════════════════════════════════════ */
function detectCategoria(titulo: string): string {
  const t = titulo.toLowerCase();
  if (t.includes("air fryer") || t.includes("fritadeira") || t.includes("naf") || t.includes("af-")) return "Air Fryer";
  if (t.includes("liquidificador") || t.includes("blender"))   return "Liquidificador";
  if (t.includes("ventilador"))                                 return "Ventilador";
  if (t.includes("panela"))                                     return "Panela Elétrica";
  if (t.includes("batedeira"))                                  return "Batedeira";
  if (t.includes("cafeteira") || t.includes("café"))            return "Cafeteira";
  if (t.includes("ferro") || t.includes("vaporizador"))         return "Ferro/Vaporizador";
  return "Outros";
}

/* ════════════════════════════════════
   PARSER — planilha de VENDA (catálogo atual)
   Colunas: SKU | Título | Valor Produto
════════════════════════════════════ */
function parseVenda(file: File): Promise<Record<string, { titulo: string; venda: number }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const map: Record<string, { titulo: string; venda: number }> = {};
        rows.forEach((r) => {
          const sku = String(r["SKU"] || r["sku"] || r["Código"] || "").trim();
          const titulo = String(r["Título"] || r["titulo"] || r["Nome"] || r["nome"] || r["Produto"] || "").trim();
          const venda = Number(r["Valor Produto"] || r["Valor"] || r["valor"] || r["Preço"] || 0);
          if (sku && titulo) map[sku] = { titulo, venda };
        });
        resolve(map);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

/* ════════════════════════════════════
   PARSER — planilha de CUSTO (Lista Mondial / o que paga)
   Colunas: SKU | Título | Qtd | Valor  (mesmo formato da ListaCompras)
════════════════════════════════════ */
function parseCusto(file: File): Promise<Record<string, { titulo: string; custo: number }>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const map: Record<string, { titulo: string; custo: number }> = {};
        rows.forEach((r) => {
          const sku = String(r["SKU"] || r["sku"] || r["Código"] || r["codigo"] || "").trim();
          const titulo = String(r["Título"] || r["titulo"] || r["Nome"] || r["nome"] || r["Produto"] || "").trim();
          const custo = Number(r["Valor"] || r["valor"] || r["Custo"] || r["custo"] || r["Preço"] || r["preco"] || 0);
          if (sku && titulo) map[sku] = { titulo, custo };
        });
        resolve(map);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

/* ════════════════════════════════════
   MERGE das duas planilhas
════════════════════════════════════ */
function merge(
  venda: Record<string, { titulo: string; venda: number }>,
  custo: Record<string, { titulo: string; custo: number }>
): Produto[] {
  const skus = new Set([...Object.keys(venda), ...Object.keys(custo)]);
  return Array.from(skus).map((sku) => {
    const v = venda[sku];
    const c = custo[sku];
    const titulo = v?.titulo || c?.titulo || sku;
    return {
      sku,
      titulo,
      custo: c?.custo ?? 0,
      venda: v?.venda ?? 0,
      categoria: detectCategoria(titulo),
    };
  }).sort((a, b) => a.titulo.localeCompare(b.titulo));
}

/* ════════════════════════════════════
   CORES DE CATEGORIA
════════════════════════════════════ */
const CAT_COLORS: Record<string, string> = {
  "Air Fryer":       "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Liquidificador":  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Ventilador":      "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "Panela Elétrica": "bg-red-500/15 text-red-400 border-red-500/30",
  "Batedeira":       "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Cafeteira":       "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Ferro/Vaporizador":"bg-slate-500/15 text-slate-400 border-slate-500/30",
  "Outros":          "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

/* ════════════════════════════════════
   COMPONENTE PRINCIPAL
════════════════════════════════════ */
export default function CatalogoAtacado() {
  const vendaRef = useRef<HTMLInputElement>(null);
  const custoRef = useRef<HTMLInputElement>(null);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [vendaMap, setVendaMap] = useState<Record<string, { titulo: string; venda: number }>>({});
  const [custoMap, setCustoMap] = useState<Record<string, { titulo: string; custo: number }>>({});

  const [busca, setBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState("Todas");
  const [faixaSel, setFaixaSel] = useState(0);
  const [abaAtiva, setAbaAtiva] = useState<"catalogo" | "pedido" | "margens">("catalogo");

  // Edição inline de produto
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editVal, setEditVal] = useState<{ titulo: string; custo: string; venda: string }>({ titulo: "", custo: "", venda: "" });

  // Carrinho
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});

  /* ── Persistir no localStorage ─────────────────────────── */
  useEffect(() => {
    const saved = localStorage.getItem("ck_catalogo_produtos");
    if (saved) {
      try { setProdutos(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (produtos.length) localStorage.setItem("ck_catalogo_produtos", JSON.stringify(produtos));
  }, [produtos]);

  /* ── Reconstruir ao importar planilha ──────────────────── */
  function rebuild(
    vm: Record<string, { titulo: string; venda: number }>,
    cm: Record<string, { titulo: string; custo: number }>,
    existing: Produto[]
  ) {
    const merged = merge(vm, cm);
    // Preservar edições manuais existentes
    return merged.map((p) => {
      const ex = existing.find((e) => e.sku === p.sku);
      return ex
        ? { ...p, custo: ex.custo || p.custo, venda: ex.venda || p.venda, titulo: ex.titulo || p.titulo }
        : p;
    });
  }

  async function handleVenda(file: File) {
    try {
      const vm = await parseVenda(file);
      setVendaMap(vm);
      setProdutos((prev) => rebuild(vm, custoMap, prev));
      toast.success(`Planilha de venda carregada: ${Object.keys(vm).length} produtos`);
    } catch { toast.error("Erro ao ler planilha de venda"); }
  }

  async function handleCusto(file: File) {
    try {
      const cm = await parseCusto(file);
      setCustoMap(cm);
      setProdutos((prev) => rebuild(vendaMap, cm, prev));
      toast.success(`Planilha de custo carregada: ${Object.keys(cm).length} produtos`);
    } catch { toast.error("Erro ao ler planilha de custo"); }
  }

  /* ── Edição inline ─────────────────────────────────────── */
  function startEdit(idx: number) {
    const p = filtrados[idx];
    setEditIdx(idx);
    setEditVal({ titulo: p.titulo, custo: String(p.custo), venda: String(p.venda) });
  }

  function confirmEdit(idx: number) {
    const p = filtrados[idx];
    setProdutos((prev) =>
      prev.map((x) =>
        x.sku === p.sku
          ? { ...x, titulo: editVal.titulo, custo: Number(editVal.custo) || 0, venda: Number(editVal.venda) || 0 }
          : x
      )
    );
    setEditIdx(null);
    toast.success("Produto atualizado");
  }

  function cancelEdit() { setEditIdx(null); }

  /* ── Adicionar produto manual ──────────────────────────── */
  function addManual() {
    const novo: Produto = {
      sku: `NOVO-${Date.now()}`,
      titulo: "Novo Produto",
      custo: 0,
      venda: 0,
      categoria: "Outros",
    };
    setProdutos((prev) => [novo, ...prev]);
    toast.success("Produto adicionado — clique em ✏️ para editar");
  }

  /* ── Remover produto ───────────────────────────────────── */
  function removeProduto(sku: string) {
    setProdutos((prev) => prev.filter((p) => p.sku !== sku));
    toast.success("Produto removido");
  }

  /* ── Filtros ────────────────────────────────────────────── */
  const categorias = useMemo(
    () => ["Todas", ...Array.from(new Set(produtos.map((p) => p.categoria))).sort()],
    [produtos]
  );

  const filtrados = useMemo(
    () =>
      produtos.filter((p) => {
        const matchB =
          !busca ||
          p.titulo.toLowerCase().includes(busca.toLowerCase()) ||
          p.sku.toLowerCase().includes(busca.toLowerCase());
        const matchC = catFiltro === "Todas" || p.categoria === catFiltro;
        return matchB && matchC;
      }),
    [produtos, busca, catFiltro]
  );

  const faixa = DEFAULT_FAIXAS[faixaSel];

  /* ── Carrinho ───────────────────────────────────────────── */
  function addCarrinho(sku: string) {
    setCarrinho((prev) => ({ ...prev, [sku]: (prev[sku] || 0) + 1 }));
  }
  function setQtd(sku: string, q: number) {
    if (q <= 0) setCarrinho((prev) => { const n = { ...prev }; delete n[sku]; return n; });
    else setCarrinho((prev) => ({ ...prev, [sku]: q }));
  }

  const totalUn = Object.values(carrinho).reduce((a, b) => a + b, 0);
  const itensPedido = Object.entries(carrinho).map(([sku, qtd]) => {
    const p = produtos.find((x) => x.sku === sku)!;
    if (!p) return null;
    const vUnit = p.venda * faixa.mult;
    return { ...p, qtd, vUnit, subTotal: vUnit * qtd };
  }).filter(Boolean) as any[];
  const totalPedido = itensPedido.reduce((a, b) => a + b.subTotal, 0);

  /* ── KPIs globais ──────────────────────────────────────── */
  const prodComCusto = produtos.filter((p) => p.custo > 0 && p.venda > 0);
  const margemMedia = prodComCusto.length
    ? prodComCusto.reduce((a, p) => a + ((p.venda - p.custo) / p.venda) * 100, 0) / prodComCusto.length
    : 0;

  /* ── Exportar catálogo com tabela de preços ─────────────── */
  function exportarCatalogo() {
    if (!produtos.length) return;
    const ws = XLSX.utils.json_to_sheet(
      produtos.map((p) => {
        const everton = calcEverton(p.custo);
        const embalagem = calcEmbalagem(p.titulo);
        const custoTotal = p.custo > 0 ? p.custo + everton + (embalagem ?? 0) : 0;
        return {
        SKU: p.sku,
        Produto: p.titulo,
        Categoria: p.categoria,
        "Custo (pago)": p.custo > 0 ? `R$ ${p.custo.toFixed(2)}` : "-",
        "Everton": everton > 0 ? `R$ ${everton.toFixed(2)}` : "-",
        "Embalagem": embalagem !== null ? `R$ ${embalagem.toFixed(2)}` : "?",
        "Custo Total": custoTotal > 0 ? `R$ ${custoTotal.toFixed(2)}` : "-",
        "Venda Balcão": `R$ ${p.venda.toFixed(2)}`,
        "Margem %": custoTotal > 0 ? `${(((p.venda - custoTotal) / p.venda) * 100).toFixed(1)}%` : "-",
        "10–24un (-10%)":  `R$ ${(p.venda * 0.90).toFixed(2)}`,
        "25–49un (-15%)":  `R$ ${(p.venda * 0.85).toFixed(2)}`,
        "50–99un (-20%)":  `R$ ${(p.venda * 0.80).toFixed(2)}`,
        "100+un (-25%)":   `R$ ${(p.venda * 0.75).toFixed(2)}`,
        };
      })
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo CK Atacados");
    XLSX.writeFile(wb, "Catalogo_CK_Atacados.xlsx");
    toast.success("Catálogo exportado!");
  }

  function exportarPedido() {
    if (!itensPedido.length) return;
    const ws = XLSX.utils.json_to_sheet(
      itensPedido.map((i: any) => ({
        SKU: i.sku, Produto: i.titulo, Qtd: i.qtd,
        "Valor Un.": `R$ ${i.vUnit.toFixed(2)}`,
        "Sub-total": `R$ ${i.subTotal.toFixed(2)}`,
        Faixa: faixa.label, Desconto: faixa.desc,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido");
    XLSX.writeFile(wb, `Pedido_CK_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Pedido exportado!");
  }

  function enviarWhatsApp() {
    if (!itensPedido.length) return;
    const linhas = itensPedido.map((i: any) =>
      `• ${i.titulo} (${i.sku}) — ${i.qtd}un × R$${i.vUnit.toFixed(2)} = R$${i.subTotal.toFixed(2)}`
    ).join("\n");
    const msg = `*Pedido CK Atacados — ${faixa.label} (${faixa.desc})*\n\n${linhas}\n\n*Total: R$${totalPedido.toFixed(2)}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  /* ════════════════════════════════════════════════════════ */
  return (
    <DashboardLayout section="catalogo-atacado">
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-5">

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                CK Atacados — B2B
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Catálogo de Produtos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {produtos.length > 0
                ? `${produtos.length} produtos · Custo + Venda · Margens em tempo real`
                : "Importe as planilhas de custo e venda para começar"}
            </p>
          </div>

          {/* Botões de importação */}
          <div className="flex gap-2 flex-wrap items-center">
            <input ref={vendaRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleVenda(e.target.files[0])} />
            <input ref={custoRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleCusto(e.target.files[0])} />

            <Button variant="outline" size="sm" className="text-xs h-8 border-primary/30 text-primary"
              onClick={() => vendaRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Planilha Venda
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8 border-blue-500/30 text-blue-400"
              onClick={() => custoRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Planilha Custo
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={addManual}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
            {produtos.length > 0 && (
              <>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={exportarCatalogo}>
                  <Download className="h-3 w-3 mr-1" /> Exportar
                </Button>
                <Button size="sm" className="text-xs h-8" onClick={() => setAbaAtiva("pedido")}>
                  <ShoppingCart className="h-3 w-3 mr-1" /> Pedido {totalUn > 0 && `(${totalUn})`}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ESTADO VAZIO */}
        {produtos.length === 0 && (
          <div className="border-2 border-dashed border-border/40 rounded-xl p-12 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground mb-1">Importe suas planilhas</p>
            <p className="text-xs text-muted-foreground mb-4">
              <strong>Planilha Venda</strong> — catálogo com preços de venda (SKU | Título | Valor Produto)<br />
              <strong>Planilha Custo</strong> — o que você paga (SKU | Título | Valor)<br />
              Pode importar uma, as duas, ou adicionar manualmente.
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button size="sm" className="text-xs" onClick={() => vendaRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> Planilha Venda
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => custoRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> Planilha Custo
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={addManual}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar Manual
              </Button>
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        {produtos.length > 0 && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Produtos", value: produtos.length, icon: Package, color: "text-primary" },
                { label: "Com custo mapeado", value: produtos.filter((p) => p.custo > 0).length, icon: DollarSign, color: "text-blue-400" },
                { label: "Margem média", value: `${margemMedia.toFixed(1)}%`, icon: TrendingUp, color: margemMedia > 40 ? "text-emerald-400" : "text-amber-400" },
                { label: "No pedido", value: totalUn, icon: ShoppingCart, color: "text-amber-400" },
              ].map((k) => (
                <div key={k.label} className="bg-card border border-border/50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                      <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                    </div>
                    <k.icon className={`h-5 w-5 ${k.color} opacity-60`} />
                  </div>
                </div>
              ))}
            </div>

            {/* ABAS */}
            <div className="flex gap-1 border-b border-border/30">
              {(["catalogo", "pedido", "margens"] as const).map((aba) => (
                <button key={aba} onClick={() => setAbaAtiva(aba)}
                  className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                    abaAtiva === aba
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  {aba === "catalogo" && "📦 Catálogo"}
                  {aba === "pedido" && `🛒 Pedido (${totalUn})`}
                  {aba === "margens" && "📊 Margens"}
                </button>
              ))}
            </div>

            {/* FAIXAS DE PREÇO */}
            {abaAtiva !== "margens" && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" /> Faixa de volume:
                </span>
                {DEFAULT_FAIXAS.map((f, i) => (
                  <button key={i} onClick={() => setFaixaSel(i)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                      faixaSel === i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border/50 text-muted-foreground hover:border-border"
                    }`}>
                    {f.label} <span className="opacity-70">{f.desc}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ══════════════════════════════════════════
                ABA: CATÁLOGO
            ══════════════════════════════════════════ */}
            {abaAtiva === "catalogo" && (
              <>
                {/* Filtros */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Buscar por nome, modelo ou SKU..."
                      className="pl-9 h-8 text-xs" value={busca}
                      onChange={(e) => setBusca(e.target.value)} />
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {categorias.map((c) => (
                      <button key={c} onClick={() => setCatFiltro(c)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          catFiltro === c
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-card border-border/30 text-muted-foreground hover:border-border/60"
                        }`}>
                        {c}{c !== "Todas" && ` (${produtos.filter((p) => p.categoria === c).length})`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tabela */}
                <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/30 bg-muted/20">
                          <th className="text-left p-3 text-xs text-muted-foreground font-medium">SKU</th>
                          <th className="text-left p-3 text-xs text-muted-foreground font-medium">Produto</th>
                          <th className="text-left p-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Categoria</th>
                          <th className="text-right p-3 text-xs text-muted-foreground font-medium">Custo</th>
                          <th className="text-right p-3 text-[10px] text-muted-foreground font-medium hidden lg:table-cell" title="Comissão do Everton (gerente Mondial). <R$5 = R$0,40 / ≥R$5 = R$0,90">Everton</th>
                          <th className="text-right p-3 text-[10px] text-muted-foreground font-medium hidden lg:table-cell" title="Embalagem: botão R$0,30 / pequeno c/bolha R$0,95 / grande c/caixa R$3,45">Embal.</th>
                          <th className="text-right p-3 text-[10px] text-muted-foreground font-medium hidden lg:table-cell" title="Custo total real (custo + Everton + embalagem)">Custo Total</th>
                          <th className="text-right p-3 text-xs text-muted-foreground font-medium">Venda</th>
                          {faixaSel > 0 && (
                            <th className="text-right p-3 text-xs text-muted-foreground font-medium hidden md:table-cell">
                              {faixa.label}
                            </th>
                          )}
                          <th className="text-right p-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Margem</th>
                          <th className="text-center p-3 text-xs text-muted-foreground font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrados.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="text-center p-8 text-muted-foreground text-xs">
                              Nenhum produto encontrado
                            </td>
                          </tr>
                        ) : (
                          filtrados.map((p, i) => {
                            const isEdit = editIdx === i;
                            const everton = calcEverton(p.custo);
                            const embalagem = calcEmbalagem(p.titulo);
                            const custoTotal = p.custo > 0
                              ? p.custo + everton + (embalagem ?? 0)
                              : 0;
                            // Margem usa custo TOTAL real (custo + Everton + embalagem)
                            const margem = custoTotal > 0 && p.venda > 0
                              ? ((p.venda - custoTotal) / p.venda) * 100
                              : null;
                            const precoFaixa = p.venda * faixa.mult;
                            const noCarrinho = carrinho[p.sku] || 0;

                            return (
                              <tr key={p.sku} className={`border-b border-border/10 transition-colors ${isEdit ? "bg-primary/5" : "hover:bg-muted/10"}`}>

                                {/* SKU */}
                                <td className="p-3">
                                  {isEdit ? (
                                    <Input value={editVal.titulo} onChange={(e) => setEditVal((v) => ({ ...v, titulo: e.target.value }))}
                                      className="h-7 text-xs w-full" placeholder="Nome do produto" />
                                  ) : (
                                    <span className="text-xs font-mono text-muted-foreground">{p.sku}</span>
                                  )}
                                </td>

                                {/* Título */}
                                <td className="p-3">
                                  {isEdit ? (
                                    <span className="text-xs font-mono text-muted-foreground">{p.sku}</span>
                                  ) : (
                                    <span className="text-xs font-medium text-foreground leading-tight">{p.titulo}</span>
                                  )}
                                </td>

                                {/* Categoria */}
                                <td className="p-3 hidden md:table-cell">
                                  <Badge className={`text-[10px] border ${CAT_COLORS[p.categoria] || ""}`}>
                                    {p.categoria}
                                  </Badge>
                                </td>

                                {/* Custo */}
                                <td className="p-3 text-right">
                                  {isEdit ? (
                                    <Input value={editVal.custo} onChange={(e) => setEditVal((v) => ({ ...v, custo: e.target.value }))}
                                      className="h-7 text-xs w-24 text-right ml-auto" type="number" step="0.01" placeholder="0.00" />
                                  ) : (
                                    <span className={`text-xs ${p.custo > 0 ? "text-blue-400 font-medium" : "text-muted-foreground/40"}`}>
                                      {p.custo > 0 ? `R$${p.custo.toFixed(2)}` : "—"}
                                    </span>
                                  )}
                                </td>

                                {/* Everton */}
                                <td className="p-3 text-right hidden lg:table-cell">
                                  <span className={`text-[11px] ${everton > 0 ? "text-purple-400" : "text-muted-foreground/40"}`}>
                                    {everton > 0 ? `R$${everton.toFixed(2)}` : "—"}
                                  </span>
                                </td>

                                {/* Embalagem */}
                                <td className="p-3 text-right hidden lg:table-cell">
                                  {embalagem !== null ? (
                                    <span className="text-[11px] text-cyan-400">R${embalagem.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-[11px] text-amber-400" title="Categoria não mapeada — me avise qual bucket aplicar">?</span>
                                  )}
                                </td>

                                {/* Custo Total */}
                                <td className="p-3 text-right hidden lg:table-cell">
                                  <span className={`text-xs font-bold ${custoTotal > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                                    {custoTotal > 0 ? `R$${custoTotal.toFixed(2)}` : "—"}
                                  </span>
                                </td>

                                {/* Venda */}
                                <td className="p-3 text-right">
                                  {isEdit ? (
                                    <Input value={editVal.venda} onChange={(e) => setEditVal((v) => ({ ...v, venda: e.target.value }))}
                                      className="h-7 text-xs w-24 text-right ml-auto" type="number" step="0.01" placeholder="0.00" />
                                  ) : (
                                    <span className="text-xs font-bold text-foreground">
                                      {p.venda > 0 ? `R$${p.venda.toFixed(2)}` : "—"}
                                    </span>
                                  )}
                                </td>

                                {/* Preço na faixa */}
                                {faixaSel > 0 && (
                                  <td className="p-3 text-right hidden md:table-cell">
                                    <span className="text-xs font-bold text-emerald-400">
                                      {p.venda > 0 ? `R$${precoFaixa.toFixed(2)}` : "—"}
                                    </span>
                                  </td>
                                )}

                                {/* Margem */}
                                <td className="p-3 text-right hidden md:table-cell">
                                  {margem !== null ? (
                                    <span className={`text-xs font-bold ${
                                      margem >= 50 ? "text-emerald-400" :
                                      margem >= 30 ? "text-amber-400" : "text-red-400"
                                    }`}>
                                      {margem.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground/40">—</span>
                                  )}
                                </td>

                                {/* Ações */}
                                <td className="p-3">
                                  <div className="flex items-center justify-center gap-1">
                                    {isEdit ? (
                                      <>
                                        <button onClick={() => confirmEdit(i)} className="text-emerald-400 hover:text-emerald-300 p-1 rounded hover:bg-emerald-400/10">
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/20">
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={() => startEdit(i)} className="text-muted-foreground hover:text-primary p-1 rounded hover:bg-primary/10" title="Editar">
                                          <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        {noCarrinho > 0 ? (
                                          <>
                                            <button onClick={() => setQtd(p.sku, noCarrinho - 1)} className="w-5 h-5 rounded bg-muted text-xs font-bold">−</button>
                                            <span className="text-xs font-bold text-primary w-4 text-center">{noCarrinho}</span>
                                            <button onClick={() => setQtd(p.sku, noCarrinho + 1)} className="w-5 h-5 rounded bg-muted text-xs font-bold">+</button>
                                          </>
                                        ) : (
                                          <button onClick={() => addCarrinho(p.sku)} className="text-muted-foreground hover:text-amber-400 p-1 rounded hover:bg-amber-400/10" title="Adicionar ao pedido">
                                            <ShoppingCart className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                        <button onClick={() => removeProduto(p.sku)} className="text-muted-foreground hover:text-red-400 p-1 rounded hover:bg-red-400/10" title="Remover">
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 border-t border-border/20 text-xs text-muted-foreground">
                    Mostrando {filtrados.length} de {produtos.length} produtos · Clique em ✏️ para editar qualquer preço
                  </div>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════
                ABA: PEDIDO
            ══════════════════════════════════════════ */}
            {abaAtiva === "pedido" && (
              <div className="space-y-4">
                {itensPedido.length === 0 ? (
                  <div className="border-2 border-dashed border-border/30 rounded-xl p-10 text-center">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum item no pedido</p>
                    <Button size="sm" variant="outline" className="mt-3 text-xs" onClick={() => setAbaAtiva("catalogo")}>
                      Ir para o catálogo
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
                      <div className="p-3 border-b border-border/20 flex items-center justify-between">
                        <p className="text-sm font-semibold">Pedido CK Atacados — {faixa.label} ({faixa.desc})</p>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{itensPedido.length} itens</Badge>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/30 bg-muted/20">
                            <th className="text-left p-3 text-xs text-muted-foreground font-medium">Produto</th>
                            <th className="text-right p-3 text-xs text-muted-foreground font-medium">Un.</th>
                            <th className="text-right p-3 text-xs text-muted-foreground font-medium">Qtd</th>
                            <th className="text-right p-3 text-xs text-muted-foreground font-medium">Sub-total</th>
                            <th className="text-center p-3 text-xs text-muted-foreground font-medium">✕</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itensPedido.map((item: any) => (
                            <tr key={item.sku} className="border-b border-border/10">
                              <td className="p-3">
                                <p className="text-xs font-medium">{item.titulo}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{item.sku}</p>
                              </td>
                              <td className="p-3 text-right"><span className="text-xs text-emerald-400 font-bold">R${item.vUnit.toFixed(2)}</span></td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => setQtd(item.sku, item.qtd - 1)} className="w-5 h-5 rounded bg-muted text-xs font-bold">−</button>
                                  <span className="text-xs font-bold w-5 text-center">{item.qtd}</span>
                                  <button onClick={() => setQtd(item.sku, item.qtd + 1)} className="w-5 h-5 rounded bg-muted text-xs font-bold">+</button>
                                </div>
                              </td>
                              <td className="p-3 text-right"><span className="text-xs font-bold">R${item.subTotal.toFixed(2)}</span></td>
                              <td className="p-3 text-center">
                                <button onClick={() => setQtd(item.sku, 0)} className="text-xs text-red-400 hover:text-red-300">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-primary/5 border-t border-border/30">
                            <td colSpan={3} className="p-3 text-xs font-bold text-right">TOTAL</td>
                            <td className="p-3 text-right"><span className="text-base font-bold text-primary">R${totalPedido.toFixed(2)}</span></td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={exportarPedido}>
                        <Download className="h-3 w-3 mr-1" /> Exportar Excel
                      </Button>
                      <Button size="sm" className="text-xs h-8 bg-[#25D366] hover:bg-[#1ebe5c] text-white" onClick={enviarWhatsApp}>
                        📲 Enviar WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setCarrinho({})}>
                        Limpar pedido
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════
                ABA: MARGENS
            ══════════════════════════════════════════ */}
            {abaAtiva === "margens" && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Exibe apenas produtos com custo e preço de venda cadastrados.
                  Clique em ✏️ no catálogo para preencher os valores faltantes.
                </p>
                <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium">Produto</th>
                        <th className="text-right p-3 text-xs text-muted-foreground font-medium">Custo</th>
                        <th className="text-right p-3 text-xs text-muted-foreground font-medium">Venda</th>
                        <th className="text-right p-3 text-xs text-muted-foreground font-medium">Lucro Un.</th>
                        <th className="text-right p-3 text-xs text-muted-foreground font-medium">Margem</th>
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtos
                        .filter((p) => p.custo > 0 && p.venda > 0)
                        .sort((a, b) => {
                          const ma = ((a.venda - a.custo) / a.venda) * 100;
                          const mb = ((b.venda - b.custo) / b.venda) * 100;
                          return mb - ma;
                        })
                        .map((p) => {
                          const margem = ((p.venda - p.custo) / p.venda) * 100;
                          const lucro = p.venda - p.custo;
                          return (
                            <tr key={p.sku} className="border-b border-border/10 hover:bg-muted/5">
                              <td className="p-3">
                                <p className="text-xs font-medium">{p.titulo}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                              </td>
                              <td className="p-3 text-right"><span className="text-xs text-blue-400">R${p.custo.toFixed(2)}</span></td>
                              <td className="p-3 text-right"><span className="text-xs font-bold">R${p.venda.toFixed(2)}</span></td>
                              <td className="p-3 text-right">
                                <span className={`text-xs font-bold ${lucro > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  R${lucro.toFixed(2)}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <span className={`text-xs font-bold ${
                                  margem >= 50 ? "text-emerald-400" :
                                  margem >= 30 ? "text-amber-400" : "text-red-400"
                                }`}>
                                  {margem.toFixed(1)}%
                                </span>
                              </td>
                              <td className="p-3">
                                <Badge className={`text-[10px] border ${
                                  margem >= 50 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                                  margem >= 30 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                                  "bg-red-500/15 text-red-400 border-red-500/30"
                                }`}>
                                  {margem >= 50 ? "✓ Excelente" : margem >= 30 ? "↗ Boa" : "⚠ Baixa"}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-border/20 text-xs text-muted-foreground">
                    {produtos.filter((p) => p.custo > 0 && p.venda > 0).length} produtos com margem calculada
                    · {produtos.filter((p) => p.custo === 0 || p.venda === 0).length} sem dados completos
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
