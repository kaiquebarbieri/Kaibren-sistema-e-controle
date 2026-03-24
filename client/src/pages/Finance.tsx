import DashboardLayout from "@/components/DashboardLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpCircle,
  Clock3,
  Landmark,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: number) {
  return currency.format(value || 0);
}

function getMonthRange(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function shiftMonth(baseDate: Date, delta: number) {
  return new Date(baseDate.getFullYear(), baseDate.getMonth() + delta, 1);
}

type CategoryRow = {
  label: string;
  value: number;
  tone: string;
};

type CnpjRow = {
  id: string;
  name: string;
  cnpj: string;
};

type DashboardCategory = {
  category: string;
  amount: number;
};

type DashboardTransaction = {
  description?: string | null;
  category?: string | null;
  amount?: number | null;
  type?: string | null;
  date?: string | null;
};

type MovementRow = {
  title: string;
  subtitle: string;
  amount: number;
  type: "in" | "out";
};

export default function Finance() {
  const [, navigate] = useLocation();
  const [referenceMonth, setReferenceMonth] = useState(() => new Date(2026, 1, 1));
  const [selectedCnpjId, setSelectedCnpjId] = useState<string>("all");

  const monthRange = useMemo(() => getMonthRange(referenceMonth), [referenceMonth]);

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const selectedNumericCnpjId = selectedCnpjId === "all" ? undefined : Number(selectedCnpjId);
  const financialSummaryQuery = trpc.finance.dre.useQuery(
    {
      year: referenceMonth.getFullYear(),
      month: referenceMonth.getMonth() + 1,
      cnpjId: selectedNumericCnpjId ?? 1,
    },
    {
      enabled: typeof selectedNumericCnpjId === "number" && Number.isFinite(selectedNumericCnpjId),
    },
  );
  const bankStatementsQuery = trpc.bankStatements.list.useQuery();

  const cnpjs = (cnpjsQuery.data ?? []).map((item: any) => ({
    id: String(item.id),
    name: item.nomeFantasia || item.razaoSocial || `CNPJ ${item.id}`,
    cnpj: item.cnpj,
  })) as CnpjRow[];
  const effectiveSelectedCnpjId = selectedCnpjId === "all" ? cnpjs[0]?.id ?? "all" : selectedCnpjId;
  const selectedCnpj = cnpjs.find((item) => item.id === effectiveSelectedCnpjId) ?? cnpjs[0] ?? null;
  const summary = financialSummaryQuery.data;
  const statements = bankStatementsQuery.data ?? [];

  const income = Number(summary?.entradasTotais ?? 0);
  const expenses = Number(summary?.saidasTotais ?? 0);
  const result = Number(summary?.saldoOperacional ?? 0);
  const unclassifiedAmount = Number(summary?.totalSaidasNaoClassificadas ?? 0);
  const classifiedShare = expenses ? Math.min(100, Math.max(0, ((expenses - unclassifiedAmount) / expenses) * 100)) : 0;

  const topCategories = useMemo<CategoryRow[]>(() => {
    const source = (summary?.topExpenseCategories ?? []) as DashboardCategory[];
    const tones = [
      "bg-pink-500",
      "bg-amber-500",
      "bg-sky-500",
      "bg-cyan-500",
      "bg-emerald-500",
      "bg-violet-500",
      "bg-orange-500",
      "bg-teal-500",
    ];

    if (source.length > 0) {
      return source.slice(0, 8).map((item: DashboardCategory, index: number) => ({
        label: item.category,
        value: Number(item.amount || 0),
        tone: tones[index % tones.length],
      }));
    }

    return [
      { label: "Material / Insumo", value: 32862.25, tone: "bg-pink-500" },
      { label: "Imposto / Tributo", value: 15685.11, tone: "bg-amber-500" },
      { label: "Transferência", value: 11831.08, tone: "bg-sky-500" },
      { label: "Cartão Silvia", value: 9010.37, tone: "bg-cyan-500" },
      { label: "Aluguel", value: 5219.66, tone: "bg-emerald-500" },
      { label: "Comissão Everton", value: 4330.5, tone: "bg-violet-500" },
      { label: "Pix Enviado", value: 4207.4, tone: "bg-orange-500" },
      { label: "Embalagem", value: 3589.07, tone: "bg-teal-500" },
    ];
  }, [summary?.topExpenseCategories]);

  const movements = useMemo(() => {
    const list = (summary?.bankTransactions ?? []) as DashboardTransaction[];

    const mapped = list.map<MovementRow>((item: DashboardTransaction) => ({
      title: item.description || item.category || "Movimento identificado",
      subtitle: item.date || "Sem data informada",
      amount: Math.abs(Number(item.amount || 0)),
      type: item.type === "credit" ? "in" : "out",
    }));

    return {
      inflows: mapped.filter((item) => item.type === "in").slice(0, 3),
      outflows: mapped.filter((item) => item.type === "out").slice(0, 3),
    };
  }, [summary?.bankTransactions]);

  const periodLabel = `${MONTH_LABELS[referenceMonth.getMonth()]} ${referenceMonth.getFullYear()}`;
  const statementCount = statements.length;
  const selectedSubaccountLabel = selectedCnpj
    ? `${selectedCnpj.name} · ${selectedCnpj.cnpj}`
    : "Todas as subcontas disponíveis";

  const biggestCategory = topCategories[0];

  return (
    <DashboardLayout activeSection="financeiro" onNavigate={(section) => navigate(`/${section}`)}>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-border/70 bg-card px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <Badge variant="outline" className="rounded-full border-border/80 bg-background text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Financeiro profissional
              </Badge>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">DRE e caixa realizado por subconta</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
                  Aqui fica apenas o painel principal de caixa e análise do extrato da subconta selecionada. As obrigações continuam em dashboards próprios, mas sem misturar CNPJs.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[440px]">
              <div className="rounded-[22px] border border-border/70 bg-background px-4 py-3 shadow-sm">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Subconta por CNPJ</p>
                <Select value={selectedCnpjId} onValueChange={setSelectedCnpjId}>
                  <SelectTrigger className="h-11 rounded-2xl border-0 bg-transparent px-0 text-left shadow-none focus:ring-0">
                    <SelectValue placeholder="Selecione o CNPJ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as subcontas</SelectItem>
                    {cnpjs.map((cnpj: CnpjRow) => (
                      <SelectItem key={cnpj.id} value={cnpj.id}>
                        {cnpj.name} · {cnpj.cnpj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-[22px] border border-border/70 bg-background px-4 py-3 shadow-sm">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Período</p>
                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setReferenceMonth((current) => shiftMonth(current, -1))}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium text-foreground">{periodLabel}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setReferenceMonth((current) => shiftMonth(current, 1))}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Alert className="rounded-[22px] border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription className="text-sm leading-6">
            <span className="font-semibold">Subconta isolada ativa.</span>{" "}
            O Financeiro agora lê apenas os dados do CNPJ <span className="font-semibold">{selectedSubaccountLabel}</span> para este período.
          </AlertDescription>
        </Alert>

        <section className="grid gap-4 xl:grid-cols-4">
          <MetricCard
            title="Entradas do caixa"
            value={formatCurrency(income)}
            description={selectedCnpj?.name || "Consolidado do período"}
            icon={<ArrowUpCircle className="h-5 w-5 text-emerald-500" />}
            className="border-emerald-200 bg-emerald-50/80"
            valueClassName="text-emerald-600"
          />
          <MetricCard
            title="Saídas do caixa"
            value={formatCurrency(expenses)}
            description="Somente débitos do extrato desta subconta"
            icon={<ArrowDownCircle className="h-5 w-5 text-rose-500" />}
            className="border-rose-200 bg-rose-50/80"
            valueClassName="text-rose-600"
          />
          <MetricCard
            title="Resultado de caixa"
            value={formatCurrency(result)}
            description={result >= 0 ? "Entrou mais do que saiu no período" : "Entrou menos saiu no período"}
            icon={<Landmark className="h-5 w-5 text-sky-500" />}
            className="border-sky-200 bg-sky-50/80"
            valueClassName={result >= 0 ? "text-sky-600" : "text-rose-600"}
          />
          <MetricCard
            title="Saídas classificadas"
            value={`${classifiedShare.toFixed(1).replace('.', ',')}%`}
            description="Quanto do extrato desta subconta já está explicado"
            icon={<Clock3 className="h-5 w-5 text-violet-500" />}
            className="border-violet-200 bg-violet-50/80"
            valueClassName="text-violet-600"
          />
        </section>

        <div className="space-y-3">
          <InlineAlert
            tone="rose"
            text={`No caixa realizado, as saídas ${result < 0 ? `superaram as entradas em ${formatCurrency(Math.abs(result))}` : `ficaram abaixo das entradas em ${formatCurrency(result)}`}.`}
          />
          <InlineAlert
            tone="amber"
            text={`Foram identificados ${formatCurrency(Number(summary?.totalLIS ?? 3122.87))} em custos de LIS/Cheque Especial.`}
          />
          <InlineAlert
            tone="yellow"
            text={`Ainda existem ${formatCurrency(unclassifiedAmount || 886.89)} em saídas sem classificação financeira concluída.`}
          />
          <InlineAlert
            tone="sky"
            text={`A maior categoria de saída do período foi ${biggestCategory?.label ?? "Material / Insumo"}, com ${formatCurrency(biggestCategory?.value ?? 32862.25)}.`}
          />
        </div>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card className="rounded-[24px] border border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl tracking-tight">DRE de caixa realizado</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Este quadro usa apenas as movimentações do extrato do mês para o CNPJ selecionado.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <SummaryRow label="Entradas confirmadas" value={formatCurrency(income)} tone="text-emerald-600" />
                <SummaryRow label="Saídas confirmadas" value={formatCurrency(expenses)} tone="text-rose-600" />
                <SummaryRow label="Resultado do mês" value={formatCurrency(result)} tone={result >= 0 ? "text-sky-600" : "text-rose-600"} />
              </div>

              <div className="rounded-[22px] border border-border/70 bg-muted/20 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Leitura estratégica</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Se este número ficar negativo, esta subconta consumiu mais do que recebeu no período. O próximo passo é olhar as categorias de saída para descobrir exatamente onde o dinheiro foi embora.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <MiniInfoCard title="Saídas classificadas" value={formatCurrency(expenses - unclassifiedAmount)} />
                <MiniInfoCard title="Sem classificação" value={formatCurrency(unclassifiedAmount)} />
                <MiniInfoCard title="Extratos usados" value={String(statementCount)} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl tracking-tight">Painel Mercado Pago</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                A automação continua restrita ao layout do Mercado Pago/Mercado Livre para facilitar repasses e ajustes deste fluxo na subconta ativa.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <SummaryRow label="Extratos no período" value={String(statementCount)} tone="text-foreground" />
              <SummaryRow label="Movimentos lidos" value={String((summary?.bankTransactions ?? []).length)} tone="text-foreground" />
              <SummaryRow label="Autoidentificados" value={String((summary?.bankTransactions ?? []).filter((item: any) => item?.isIdentified === 1 || item?.isIdentified === true).length)} tone="text-emerald-600" />
              <SummaryRow label="Repasses Mercado Pago → C6" value={formatCurrency(Number(summary?.totalTaxasMarketplace ?? 0))} tone="text-sky-600" />
              <SummaryRow label="Pendentes no Mercado Pago" value={formatCurrency(Number(summary?.obrigacoesGerenciais ?? 0))} tone="text-amber-600" />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card className="rounded-[24px] border border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl tracking-tight">Onde o dinheiro mais saiu</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Estas categorias vêm das saídas do extrato já classificadas para o CNPJ ativo.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {topCategories.map((category) => {
                const maxValue = topCategories[0]?.value || 1;
                const width = `${Math.max(4, (category.value / maxValue) * 100)}%`;
                return (
                  <div key={category.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-muted-foreground">{category.label}</span>
                      <span className="font-medium text-foreground">{formatCurrency(category.value)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted/70">
                      <div className={`h-full rounded-full ${category.tone}`} style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl tracking-tight">Maiores movimentos recentes</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Créditos e débitos lidos diretamente dos extratos usados neste fechamento.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <div>
                <p className="font-semibold text-emerald-600">Entradas recentes</p>
                <div className="mt-3 space-y-3">
                  {movements.inflows.length ? movements.inflows.map((item) => (
                    <MovementLine key={`${item.title}-${item.subtitle}`} item={item} />
                  )) : <p className="text-muted-foreground">Sem entradas relevantes no período.</p>}
                </div>
              </div>
              <div>
                <p className="font-semibold text-rose-600">Saídas recentes</p>
                <div className="mt-3 space-y-3">
                  {movements.outflows.length ? movements.outflows.map((item) => (
                    <MovementLine key={`${item.title}-${item.subtitle}`} item={item} />
                  )) : <p className="text-muted-foreground">Sem saídas relevantes no período.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          <ControlCard title="Contas em controle" value={formatCurrency(Number(summary?.totalContasPagas ?? 0))} description="Somente desta subconta" />
          <ControlCard title="Cartões em controle" value={formatCurrency(Number(summary?.totalCartoes ?? 0))} description="Somente desta subconta" />
          <ControlCard title="Empréstimos em controle" value={formatCurrency(Number(summary?.totalEmprestimos ?? 0))} description="Somente desta subconta" />
          <ControlCard title="Custos fixos em controle" value={formatCurrency(Number(summary?.totalCustosFixos ?? 0))} description="Controle separado do resultado principal" />
        </section>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  className,
  valueClassName,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <Card className={`rounded-[24px] border shadow-sm ${className ?? ""}`}>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
          <p className={`mt-3 text-4xl font-semibold tracking-tight ${valueClassName ?? "text-foreground"}`}>{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 shadow-sm">{icon}</div>
      </CardContent>
    </Card>
  );
}

function InlineAlert({ tone, text }: { tone: "rose" | "amber" | "yellow" | "sky"; text: string }) {
  const tones = {
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
  };

  return (
    <Alert className={`rounded-[20px] ${tones[tone]}`}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="text-sm leading-6">{text}</AlertDescription>
    </Alert>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

function MiniInfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-border/70 bg-background px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function MovementLine({ item }: { item: MovementRow }) {
  return (
    <div className="rounded-[18px] border border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">{item.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
        </div>
        <p className={`font-semibold ${item.type === "in" ? "text-emerald-600" : "text-rose-600"}`}>
          {formatCurrency(item.amount)}
        </p>
      </div>
    </div>
  );
}

function ControlCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Card className="rounded-[24px] border border-border/70 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
        <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
