import DashboardLayout from "@/components/DashboardLayout";
import LiaChat from "@/components/LiaChat";
import PeriodFilter, { periodToDateRange, periodLabel, usePeriod } from "@/components/PeriodFilter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { BarChart3, Building2, Info, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const pct = (n: number) =>
  (n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

type DreRow = {
  label: string;
  value: number | null;
  prev?: number | null;
  indent?: boolean;
  bold?: boolean;
  highlight?: "positive" | "negative" | "neutral";
  tooltip?: string;
  pctReceita?: boolean;
};

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-zinc-600">—</span>;
  if (previous === 0) return <span className="text-emerald-400">+∞</span>;
  const diff = ((current - previous) / Math.abs(previous)) * 100;
  const positive = diff >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? "text-emerald-400" : "text-red-400";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}
      {diff.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
    </span>
  );
}

function DreRowItem({ row, receitaBase }: { row: DreRow; receitaBase: number }) {
  const hasValue = row.value !== null && row.value !== undefined;
  const valueStr = hasValue ? brl(row.value!) : "—";
  const prevValueStr = row.prev !== null && row.prev !== undefined ? brl(row.prev) : null;

  const rowColor =
    row.highlight === "positive" ? "text-emerald-400" :
    row.highlight === "negative" ? "text-red-400" :
    row.bold ? "text-zinc-100" : "text-zinc-300";

  const pctStr = hasValue && receitaBase > 0 ? pct(row.value! / receitaBase) : null;

  return (
    <tr className={`border-b border-zinc-800/50 ${row.bold ? "bg-zinc-900/40" : ""}`}>
      <td className={`py-2.5 px-3 text-sm ${row.indent ? "pl-8" : ""} ${row.bold ? "font-bold" : ""} ${rowColor}`}>
        <div className="flex items-center gap-1.5">
          <span>{row.label}</span>
          {row.tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-zinc-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{row.tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
      <td className={`py-2.5 px-3 text-right text-sm font-mono ${row.bold ? "font-bold" : ""} ${rowColor}`}>
        {hasValue ? valueStr : <span className="text-zinc-600">—</span>}
      </td>
      <td className="py-2.5 px-3 text-right text-xs text-zinc-500 font-mono">
        {pctStr ?? ""}
      </td>
      <td className="py-2.5 px-3 text-right text-xs text-zinc-500 font-mono hidden sm:table-cell">
        {prevValueStr ?? <span className="text-zinc-700">—</span>}
      </td>
      <td className="py-2.5 px-3 text-right hidden md:table-cell">
        {hasValue && row.prev !== null && row.prev !== undefined
          ? <Delta current={row.value!} previous={row.prev} />
          : null}
      </td>
    </tr>
  );
}

function buildRows(
  cur: any,
  prev: any,
  fixedCostsCadastrados: number,
  adsSpend: { total: number; meta: number; ml: number; shopee: number } | null,
): DreRow[] {
  const despesasTooltip = fixedCostsCadastrados === 0
    ? "Nenhum custo fixo cadastrado. Acesse Financeiro → Custos Fixos para cadastrar aluguel, internet, contador etc."
    : undefined;
  const adsTooltip = adsSpend
    ? `Estimado pelo período. Meta: ${(adsSpend.meta).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · ML Ads: ${(adsSpend.ml).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Shopee Ads: ${(adsSpend.shopee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
    : "Carregando dados das APIs Meta + ML + Shopee Ads…";
  const adsTotal = adsSpend?.total ?? null;
  const margemAposAds = adsTotal !== null ? cur.margemContribuicao - adsTotal : null;
  const lucroOperacionalReal = (fixedCostsCadastrados > 0 && adsTotal !== null)
    ? cur.lucroOperacional - adsTotal
    : (fixedCostsCadastrados > 0 ? cur.lucroOperacional : null);

  return [
    { label: "RECEITA BRUTA", value: cur.receitaBruta.total, prev: prev.receitaBruta.total, bold: true },
    { label: "Mercado Livre", value: cur.receitaBruta.ml, prev: prev.receitaBruta.ml, indent: true },
    { label: "Shopee", value: cur.receitaBruta.shopee, prev: prev.receitaBruta.shopee, indent: true },

    { label: "(−) DEDUÇÕES DE VENDAS", value: cur.totalDeducoes, prev: prev.totalDeducoes, bold: true, highlight: "negative" },
    { label: "Comissões marketplace", value: cur.comissoes.total, prev: prev.comissoes.total, indent: true, tooltip: "Aplica taxa por pedido conforme tabela editável em Configurações → Taxas" },
    { label: "Taxas fixas por item", value: cur.taxasFixas.total, prev: prev.taxasFixas.total, indent: true },
    { label: "Taxa de transação (Shopee)", value: cur.taxaTransacao.total, prev: prev.taxaTransacao.total, indent: true },
    { label: "Frete subsidiado (seller)", value: cur.freteSeller.total, prev: prev.freteSeller.total, indent: true, tooltip: "ML: frete grátis obrigatório acima de R$ 79. Shopee: coparticipação ~25% do frete real" },

    { label: "(−) IMPOSTOS SOBRE VENDAS", value: cur.impostos.total, prev: prev.impostos.total, bold: true, highlight: "negative", tooltip: "Alíquota efetiva calculada via Simples Nacional Anexo I a partir do RBT12 (receita bruta últimos 12 meses). Override por empresa em Configurações → Empresas → Alíquotas." },

    { label: "RECEITA LÍQUIDA", value: cur.receitaLiquida, prev: prev.receitaLiquida, bold: true },

    { label: "(−) CMV (Custo da Mercadoria Vendida)", value: cur.cmv.total, prev: prev.cmv.total, bold: true, highlight: "negative",
      tooltip: cur.cmv.missing > 0
        ? `${cur.cmv.missing} pedidos sem custo cadastrado — CMV subestimado. Complete products.valorProduto para precisão.`
        : undefined },

    { label: "LUCRO BRUTO", value: cur.lucroBruto, prev: prev.lucroBruto, bold: true, highlight: cur.lucroBruto >= 0 ? "positive" : "negative" },

    { label: "(−) CUSTOS VARIÁVEIS DIRETOS", value: cur.custosVariaveisDiretos, prev: prev.custosVariaveisDiretos, bold: true, highlight: "negative", tooltip: "Custos por peça vendida que não entram no CMV contábil: Comissão Everton + Embalagem" },
    { label: "Comissão Everton (gerente Mondial)", value: cur.everton.total, prev: prev.everton.total, indent: true, tooltip: "R$ 0,40 (custo < R$ 5) ou R$ 0,90 (custo ≥ R$ 5) por peça vendida" },
    { label: "Embalagem (etiqueta + saco/bolha/caixa)", value: cur.embalagem.total, prev: prev.embalagem.total, indent: true, tooltip: "Detector por título: botão R$0,30 / pequeno R$0,95 / médio R$1,00 / grande R$3,45" },

    { label: "MARGEM DE CONTRIBUIÇÃO", value: cur.margemContribuicao, prev: prev.margemContribuicao, bold: true, highlight: cur.margemContribuicao >= 0 ? "positive" : "negative", tooltip: "Lucro Bruto − Custos Variáveis Diretos. Sobra real por venda antes das despesas fixas." },

    { label: "(−) INVESTIMENTO EM ADS", value: adsTotal, prev: undefined, bold: true, highlight: "negative", tooltip: adsTooltip },
    ...(adsSpend ? [
      { label: "Meta (Facebook + Instagram)", value: adsSpend.meta, indent: true } as DreRow,
      { label: "Mercado Livre Ads", value: adsSpend.ml, indent: true } as DreRow,
      { label: "Shopee Ads", value: adsSpend.shopee, indent: true } as DreRow,
    ] : []),

    { label: "MARGEM APÓS ADS", value: margemAposAds, prev: undefined, bold: true, highlight: (margemAposAds ?? 0) >= 0 ? "positive" : "negative" },

    { label: "(−) DESPESAS OPERACIONAIS", value: fixedCostsCadastrados === 0 ? null : cur.despesasOperacionais, prev: fixedCostsCadastrados === 0 ? null : prev.despesasOperacionais, bold: true, highlight: "negative", tooltip: despesasTooltip },

    { label: "LUCRO OPERACIONAL", value: lucroOperacionalReal, prev: fixedCostsCadastrados === 0 ? null : prev.lucroOperacional, bold: true, highlight: (lucroOperacionalReal ?? 0) >= 0 ? "positive" : "negative", tooltip: despesasTooltip },
  ];
}

function KPI({ label, value, prev, suffix }: { label: string; value: number; prev?: number; suffix?: string }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">{label}</div>
        <div className="text-xl font-bold text-zinc-100 font-mono">
          {suffix === "%" ? pct(value) : brl(value)}
        </div>
        {prev !== undefined && (
          <div className="mt-1">
            <Delta current={value} previous={prev} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DreGerencial() {
  const [period, setPeriod, customDate, setCustomDate, customDateEnd, setCustomDateEnd] =
    usePeriod("dre-period", "month");

  const range = useMemo(
    () => periodToDateRange(period, customDate, customDateEnd),
    [period, customDate, customDateEnd],
  );

  const query = trpc.dreGerencial.useQuery({
    start: range.start,
    end: range.end,
  });

  const adsQuery = trpc.marketingSpend.useQuery({
    start: range.start,
    end: range.end,
  });

  // Mês "atual" pra sincronização de taxas (usa o ano/mês do meio do range)
  const midPoint = useMemo(() => new Date((range.start.getTime() + range.end.getTime()) / 2), [range]);
  const syncYear = midPoint.getFullYear();
  const syncMonth = midPoint.getMonth() + 1;

  const syncMutation = trpc.syncMlFeesForMonth.useMutation({
    onSuccess: (r) => {
      toast.success(`Taxas reais atualizadas: ${r.synced} novos, ${r.skipped} já existiam, ${r.failed} falhas de ${r.total} pedidos ML`);
      query.refetch();
    },
    onError: (e) => toast.error(`Falha ao sincronizar: ${e.message}`),
  });

  const data = query.data;
  const adsSpend = adsQuery.data
    ? {
        total: adsQuery.data.total,
        meta: adsQuery.data.meta.periodEstimated,
        ml: adsQuery.data.ml.periodEstimated,
        shopee: adsQuery.data.shopee.periodEstimated,
      }
    : null;
  const rows = useMemo(() => {
    if (!data) return [] as DreRow[];
    return buildRows(data.current, data.previous, data.despesasOperacionaisCadastradas, adsSpend);
  }, [data, adsSpend]);

  const receitaBase = data?.current?.receitaBruta?.total ?? 0;

  return (
    <DashboardLayout activeSection="dre-gerencial">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-[#D4AF37]" />
              DRE Gerencial
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Receita, deduções, CMV e lucro — calculado a partir dos pedidos dos marketplaces
            </p>
          </div>

          {/* Navegador de período */}
          <div className="flex items-center gap-2">
            <PeriodFilter
              value={period}
              onChange={setPeriod}
              customDate={customDate}
              customDateEnd={customDateEnd}
              onCustomDate={setCustomDate}
              onCustomDateEnd={setCustomDateEnd}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate({ year: syncYear, month: syncMonth })}
              disabled={syncMutation.isPending}
              className="h-9 gap-1.5"
              title="Puxa taxas reais do Mercado Pago API para todos os pedidos ML do mês central do período"
            >
              {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="hidden sm:inline">Atualizar taxas reais</span>
            </Button>
          </div>
        </div>

        {query.isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          </div>
        )}

        {query.isError && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-400">
              Erro ao carregar DRE: {query.error?.message}
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* KPIs resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPI label="Receita bruta" value={data.current.receitaBruta.total} prev={data.previous.receitaBruta.total} />
              <KPI label="Receita líquida" value={data.current.receitaLiquida} prev={data.previous.receitaLiquida} />
              <KPI label="Lucro bruto" value={data.current.lucroBruto} prev={data.previous.lucroBruto} />
              <KPI
                label="Margem bruta"
                value={data.current.receitaBruta.total > 0 ? data.current.lucroBruto / data.current.receitaBruta.total : 0}
                prev={data.previous.receitaBruta.total > 0 ? data.previous.lucroBruto / data.previous.receitaBruta.total : 0}
                suffix="%"
              />
            </div>

            {/* Tabela DRE */}
            <Card className="border-zinc-800 bg-zinc-900/40">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60">
                        <th className="py-2 px-3 text-left text-[10px] uppercase tracking-wider text-zinc-500">Conta</th>
                        <th className="py-2 px-3 text-right text-[10px] uppercase tracking-wider text-zinc-500">{periodLabel(period, customDate, customDateEnd)}</th>
                        <th className="py-2 px-3 text-right text-[10px] uppercase tracking-wider text-zinc-500">% Rec.</th>
                        <th className="py-2 px-3 text-right text-[10px] uppercase tracking-wider text-zinc-500 hidden sm:table-cell">Período ant.</th>
                        <th className="py-2 px-3 text-right text-[10px] uppercase tracking-wider text-zinc-500 hidden md:table-cell">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <DreRowItem key={i} row={r} receitaBase={receitaBase} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Breakdown por empresa */}
            {data.current.byCompany && data.current.byCompany.items.length > 0 && (
              <Card className="border-zinc-800 bg-zinc-900/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-[#D4AF37]" />
                      DRE por empresa emissora
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                      <span>
                        {data.current.byCompany.empresasVinculadas} empresa{data.current.byCompany.empresasVinculadas !== 1 ? "s" : ""} vinculada{data.current.byCompany.empresasVinculadas !== 1 ? "s" : ""}
                      </span>
                      {data.current.byCompany.pedidosSemEmpresa > 0 && (
                        <span className="text-amber-400">
                          · {data.current.byCompany.pedidosSemEmpresa} pedido{data.current.byCompany.pedidosSemEmpresa !== 1 ? "s" : ""} sem empresa
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px]">
                          <th className="p-2 text-left">Empresa</th>
                          <th className="p-2 text-right">Pedidos</th>
                          <th className="p-2 text-right">Receita bruta</th>
                          <th className="p-2 text-right">Deduções MP</th>
                          <th className="p-2 text-right">Imposto</th>
                          <th className="p-2 text-right">DIFAL</th>
                          <th className="p-2 text-right">CMV</th>
                          <th className="p-2 text-right">Lucro bruto</th>
                          <th className="p-2 text-right">Alíquota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.current.byCompany.items.map((c: any) => {
                          const deducoesMp = c.comissoes + c.taxasFixas + c.taxaTransacao + c.freteSeller;
                          const isUnbound = c.cnpjId == null;
                          return (
                            <tr key={String(c.cnpjId ?? "none")} className="border-b border-zinc-800/40">
                              <td className="p-2">
                                {isUnbound ? (
                                  <span className="text-amber-400">⚠ Sem empresa vinculada</span>
                                ) : (
                                  <div className="flex flex-col">
                                    <span className="text-zinc-100 font-medium">{c.nomeFantasia || c.razaoSocial}</span>
                                    <span className="text-[10px] text-zinc-500">
                                      {c.regime ? c.regime.toUpperCase() : "—"}{c.ufOrigem ? ` · ${c.ufOrigem}` : ""}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="p-2 text-right text-zinc-300 font-mono">{c.pedidos}</td>
                              <td className="p-2 text-right text-zinc-100 font-mono">{brl(c.receitaBruta)}</td>
                              <td className="p-2 text-right text-red-400 font-mono">{brl(deducoesMp)}</td>
                              <td className="p-2 text-right text-red-400 font-mono">{brl(c.impostoAplicado)}</td>
                              <td className="p-2 text-right text-red-400/70 font-mono">
                                {c.difalTotal > 0 ? brl(c.difalTotal) : "—"}
                              </td>
                              <td className="p-2 text-right text-red-400 font-mono">{brl(c.cmv)}</td>
                              <td className={`p-2 text-right font-mono font-semibold ${c.lucroBruto >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {brl(c.lucroBruto)}
                              </td>
                              <td className="p-2 text-right">
                                {c.rateFonte === "config" && c.rateUsada != null ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                                    {Number(c.rateUsada).toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px]">
                                    fallback
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {data.current.byCompany.pedidosSemEmpresa > 0 && (
                    <p className="text-[11px] text-amber-400 mt-2">
                      Pedidos sem empresa usam imposto estimado por produto. Vincule a conta emissora em{" "}
                      <a href="/integracoes" className="underline">Integrações</a>.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Meta info */}
            <div className="text-xs text-zinc-500 space-y-1 px-1">
              <p>• {data.current.pedidos} pedidos · {data.current.unidades} unidades em {periodLabel(period, customDate, customDateEnd)}</p>
              <p>• CMV: {data.current.cmv.matched} pedidos com custo cadastrado, {data.current.cmv.missing} sem cadastro</p>
              <p>
                • Imposto Simples — alíquota efetiva calculada via Anexo I:{" "}
                <span className="text-emerald-400 font-semibold">
                  {data.aliquotaSimples.current.efetivaPct.toFixed(2)}%
                </span>
                {" "}
                ({data.aliquotaSimples.current.faixa} · RBT12 {brl(data.aliquotaSimples.current.rbt12)} · nominal {data.aliquotaSimples.current.nominalPct.toFixed(1)}% − dedução {brl(data.aliquotaSimples.current.deducao)})
                {(data.current.impostos.difal ?? 0) > 0 && (
                  <> {" · "} <span className="text-red-400">+ {brl(data.current.impostos.difal)} DIFAL</span></>
                )}
              </p>
              {(data.current.impostos.configurado ?? 0) > 0 && (
                <p className="text-emerald-400">
                  • Override por empresa cadastrada: {brl(data.current.impostos.configurado)} usados de configuração manual
                </p>
              )}
              <p>
                • Taxas ML:{" "}
                <span className="text-emerald-400">{data.current.feesSource?.mlReal ?? 0} reais (MP API)</span>
                {" · "}
                <span className="text-amber-400">{data.current.feesSource?.mlEstimated ?? 0} estimadas</span>
                {(data.current.feesSource?.mlEstimated ?? 0) > 0 && (
                  <span className="text-zinc-500"> — clique "Atualizar taxas reais" para puxar valores exatos</span>
                )}
              </p>
              <p>
                • Fonte de data:{" "}
                <span className="text-zinc-300">{data.dateSource === "invoice" ? "nota fiscal" : "data da venda"}</span>
                {" "}
                <a href="/configuracoes?tab=Sistema" className="text-[#D4AF37] hover:underline">(alterar)</a>
              </p>
              {data.despesasOperacionaisCadastradas === 0 && (
                <p className="text-amber-400">⚠ Nenhum custo fixo cadastrado — Lucro Operacional não calculado</p>
              )}
              <p>• Taxas carregadas de <a href="/configuracoes?tab=Taxas" className="text-[#D4AF37] hover:underline">Configurações → Taxas</a> · Alíquotas por empresa em <a href="/configuracoes?tab=Empresas" className="text-[#D4AF37] hover:underline">Configurações → Empresas</a></p>
            </div>
          </>
        )}
      </div>
      <LiaChat
        screenContext="DRE Gerencial"
        pageData={
          data
            ? `Período: ${periodLabel(period, customDate, customDateEnd)}. Receita bruta: ${brl(data.current.receitaBruta.total)}. Receita líquida: ${brl(data.current.receitaLiquida)}. Lucro bruto: ${brl(data.current.lucroBruto)}. Margem bruta: ${data.current.receitaBruta.total > 0 ? pct(data.current.lucroBruto / data.current.receitaBruta.total) : "—"}. Margem de Contribuição: ${brl(data.current.margemContribuicao)} (após Everton ${brl(data.current.everton.total)} + Embalagem ${brl(data.current.embalagem.total)}). CMV: ${brl(data.current.cmv.total)} (${data.current.cmv.missing} pedidos sem custo cadastrado). Pedidos: ${data.current.pedidos}.`
            : "DRE ainda carregando."
        }
        quickPrompts={[
          "Por que minha margem caiu?",
          "Como reduzir CMV?",
          "Vale migrar pra Lucro Presumido?",
        ]}
      />
    </DashboardLayout>
  );
}
