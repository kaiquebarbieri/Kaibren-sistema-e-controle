import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  Box,
  Loader2,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

const PLATFORM_COLORS: Record<string, string> = {
  mercadolivre: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  shopee: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  amazon: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  tiktok: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

export default function RelatoriosExec() {
  const execQuery = trpc.relatoriosExec.executivo.useQuery(undefined, { refetchInterval: 120000 });
  const lucroQuery = trpc.relatoriosExec.lucroML.useQuery();
  const alertasQuery = trpc.alertas.list.useQuery();

  const data = execQuery.data;
  const lucro = lucroQuery.data || [];
  const alertas = alertasQuery.data || [];

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (execQuery.isLoading) {
    return (
      <DashboardLayout activeSection="relatorios-exec">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const criticalAlerts = alertas.filter((a: any) => a.level === "critical");
  const warningAlerts = alertas.filter((a: any) => a.level === "warning");

  return (
    <DashboardLayout activeSection="relatorios-exec">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Relatório Executivo
          </h1>
          <p className="text-sm text-muted-foreground">Visão consolidada do negócio</p>
        </div>

        {/* Alertas críticos */}
        {criticalAlerts.length > 0 && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-400 text-sm font-semibold mb-2">
                <AlertTriangle className="h-4 w-4" />
                {criticalAlerts.length} Alerta(s) Crítico(s)
              </div>
              <div className="space-y-1">
                {criticalAlerts.map((a: any, i: number) => (
                  <div key={i} className="text-xs text-red-300 bg-red-500/5 rounded-lg p-2">
                    <strong>{a.title}:</strong> {a.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Avisos */}
        {warningAlerts.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold mb-2">
                <AlertTriangle className="h-4 w-4" />
                {warningAlerts.length} Aviso(s)
              </div>
              <div className="space-y-1">
                {warningAlerts.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} className="text-xs text-amber-300 bg-amber-500/5 rounded-lg p-2">
                    <strong>{a.title}:</strong> {a.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <ShoppingCart className="h-3.5 w-3.5" /> Vendas ML Hoje
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">{fmt(data.ml?.today || 0)}</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Vendas ML Mês
                  </div>
                  <div className="text-2xl font-bold text-primary">{fmt(data.ml?.month || 0)}</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Package className="h-3.5 w-3.5" /> Peças em Estoque
                  </div>
                  <div className="text-2xl font-bold text-foreground">{data.estoque.totalPecas}</div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Users className="h-3.5 w-3.5" /> Clientes
                  </div>
                  <div className="text-2xl font-bold text-foreground">{data.clientes.total}</div>
                  <div className="text-[10px] text-muted-foreground">{data.clientes.ativos} ativos</div>
                </CardContent>
              </Card>
            </div>

            {/* ML por conta */}
            {data.ml && data.ml.accounts && data.ml.accounts.length > 0 && (
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="text-sm font-semibold text-foreground mb-3">Vendas ML por Conta</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {data.ml.accounts.map((acc: any) => (
                      <div key={acc.name} className="bg-zinc-900/60 rounded-lg p-3">
                        <div className="text-xs font-medium text-primary mb-1">{acc.name}</div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Hoje:</span>
                          <span className="text-emerald-400 font-semibold">{fmt(acc.today)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Mês:</span>
                          <span className="text-foreground font-semibold">{fmt(acc.month)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Estoque baixo */}
            {data.estoque.lowStockCount > 0 && (
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    {data.estoque.lowStockCount} Produtos com Estoque Baixo
                  </div>
                  <div className="space-y-1">
                    {data.estoque.lowStockItems.map((item: any) => (
                      <div key={item.sku} className="flex items-center justify-between text-xs bg-red-500/5 rounded-lg p-2">
                        <span className="font-mono text-primary">{item.sku}</span>
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                          {item.qty} un (mín: {item.min})
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Lucro por Produto ML */}
        {lucro.length > 0 && (
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                Lucro por Produto (ML)
              </div>
              <div className="overflow-x-auto rounded-lg border border-border/30">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-900/40 border-b border-border/30">
                      <th className="text-left p-2 text-muted-foreground">Produto</th>
                      <th className="text-center p-2 text-muted-foreground">Qtd</th>
                      <th className="text-right p-2 text-muted-foreground">Receita</th>
                      <th className="text-right p-2 text-muted-foreground">Custo Un.</th>
                      <th className="text-right p-2 text-muted-foreground">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lucro.slice(0, 20).map((p: any, i: number) => (
                      <tr key={i} className="border-b border-border/20 hover:bg-zinc-900/30">
                        <td className="p-2 max-w-[250px] truncate text-foreground/80">{p.titulo}</td>
                        <td className="p-2 text-center text-foreground">{p.qtd}</td>
                        <td className="p-2 text-right text-emerald-400">{fmt(p.receita)}</td>
                        <td className="p-2 text-right text-muted-foreground">{fmt(p.custo)}</td>
                        <td className={`p-2 text-right font-bold ${p.lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {fmt(p.lucro)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
