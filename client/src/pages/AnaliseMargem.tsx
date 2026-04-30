import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PeriodFilter, { periodLabel, periodToDateRange, usePeriod } from "@/components/PeriodFilter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BarChart3, TrendingUp, TrendingDown, Package, AlertTriangle } from "lucide-react";

function formatCurrency(value: string | number | null | undefined) {
  const n = Number(String(value ?? 0).replace(",", "."));
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number | null | undefined, digits = 2) {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function marginColorClass(pct: number) {
  if (pct >= 0.25) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (pct >= 0.05) return "text-amber-600 dark:text-amber-400 font-medium";
  if (pct >= 0) return "text-red-600 dark:text-red-400 font-medium";
  return "text-red-700 dark:text-red-500 font-bold";
}

function AbcBadge({ zone }: { zone: "A" | "B" | "C" | null }) {
  if (!zone) return <span className="text-muted-foreground">—</span>;
  const styles = {
    A: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    B: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    C: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
  };
  return <Badge variant="outline" className={`${styles[zone]} font-mono`}>{zone}</Badge>;
}

export default function AnaliseMargem() {
  const [period, setPeriod, customDate, setCustomDate, customDateEnd, setCustomDateEnd] =
    usePeriod("margem-period", "month");

  const range = useMemo(
    () => periodToDateRange(period, customDate, customDateEnd),
    [period, customDate, customDateEnd],
  );

  const query = trpc.products.marginAnalysis.useQuery({ start: range.start, end: range.end });
  const data = query.data;

  return (
    <DashboardLayout activeSection="analise-margem">
      <div className="space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Análise de Margem</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Rentabilidade por produto com Curva ABC dupla (faturamento e margem). Inspirado no GeFinance.
          </p>
        </header>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6">
            <span className="text-sm text-muted-foreground">Período:</span>
            <PeriodFilter
              value={period}
              onChange={setPeriod}
              customDate={customDate}
              customDateEnd={customDateEnd}
              onCustomDate={setCustomDate}
              onCustomDateEnd={setCustomDateEnd}
            />
          </CardContent>
        </Card>

        {data && data.totals.produtosSemCusto > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  {data.totals.produtosSemCusto} de {data.totals.produtos} produtos sem custo cadastrado
                  ({formatPercent(1 - data.totals.coberturaCustoPct, 0)})
                </p>
                <p className="text-muted-foreground mt-1">
                  A margem só é calculada para SKUs com custo preenchido em <b>Produtos</b> ou no <b>Catálogo ML</b>.
                  Totais e curva ABC de margem consideram apenas produtos com custo.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" /> Produtos vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.totals.produtos ?? 0}</div>
              <p className="text-xs text-muted-foreground">{data?.totals.vendas ?? 0} unidades</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Faturamento total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data?.totals.faturamento)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Margem total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${marginColorClass(data?.totals.margemPct ?? 0)}`}>
                {formatCurrency(data?.totals.margemRs)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                {(data?.totals.margemPct ?? 0) >= 0.1 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-amber-500" />}
                Margem média
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${marginColorClass(data?.totals.margemPct ?? 0)}`}>
                {formatPercent(data?.totals.margemPct, 1)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Produtos vendidos no período</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            {query.isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
            ) : (data?.items.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma venda encontrada em {periodLabel(period, customDate, customDateEnd)}.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                    <TableHead className="text-center">ABC Fat.</TableHead>
                    <TableHead className="text-right">Margem R$</TableHead>
                    <TableHead className="text-right">Margem %</TableHead>
                    <TableHead className="text-center">ABC Margem</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.items.map((item) => (
                    <TableRow key={item.sku}>
                      <TableCell>
                        <div className="font-medium">{item.titulo}</div>
                        <div className="font-mono text-xs text-muted-foreground">{item.sku}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.vendas}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.faturamento)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(item.ticketMedio)}</TableCell>
                      <TableCell className="text-center"><AbcBadge zone={item.abcFaturamento as "A" | "B" | "C"} /></TableCell>
                      {item.temCusto ? (
                        <>
                          <TableCell className={`text-right font-mono ${marginColorClass(item.margemPct)}`}>{formatCurrency(item.margemRs)}</TableCell>
                          <TableCell className={`text-right font-mono ${marginColorClass(item.margemPct)}`}>{formatPercent(item.margemPct, 1)}</TableCell>
                          <TableCell className="text-center"><AbcBadge zone={item.abcMargem as "A" | "B" | "C" | null} /></TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right font-mono text-muted-foreground" title="Custo não cadastrado">—</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">—</TableCell>
                          <TableCell className="text-center"><AbcBadge zone={null} /></TableCell>
                        </>
                      )}
                      <TableCell className="text-right font-mono text-muted-foreground">{formatPercent(item.share, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
