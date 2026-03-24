import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CalendarDays, CreditCard, Landmark, Plus, Receipt, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type ObligationSection = "payables" | "fixed-costs" | "credit-cards" | "loans";
type DialogMode = ObligationSection | null;

type SimpleFormState = {
  title: string;
  amount: string;
  dueDate: string;
  notes: string;
};

function fmt(value: number | string | null | undefined): string {
  const parsed = Number(value || 0);
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sectionMeta(section: ObligationSection) {
  const map = {
    "payables": {
      label: "Contas a Pagar",
      description: "Cadastre e acompanhe contas do período em uma lista simples e separada.",
      icon: Receipt,
      accent: "from-rose-500 via-fuchsia-500 to-orange-400",
      button: "Nova conta",
    },
    "fixed-costs": {
      label: "Custos Fixos",
      description: "Mantenha despesas recorrentes visíveis logo após o cadastro.",
      icon: Wallet,
      accent: "from-emerald-500 via-teal-500 to-cyan-500",
      button: "Novo custo fixo",
    },
    "credit-cards": {
      label: "Cartão de Crédito",
      description: "Separe cartões em uma área própria com leitura mais direta.",
      icon: CreditCard,
      accent: "from-sky-500 via-blue-500 to-indigo-500",
      button: "Novo cartão",
    },
    "loans": {
      label: "Empréstimos",
      description: "Visualize passivos em uma lista organizada e independente.",
      icon: Landmark,
      accent: "from-amber-500 via-orange-500 to-rose-500",
      button: "Novo empréstimo",
    },
  } satisfies Record<ObligationSection, { label: string; description: string; icon: any; accent: string; button: string }>;

  return map[section];
}

function ObligationRow({
  title,
  subtitle,
  amount,
  badge,
  onDelete,
}: {
  title: string;
  subtitle: string;
  amount: string;
  badge: string;
  onDelete?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-card/95 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Badge variant="secondary" className="w-fit">{badge}</Badge>
          <div>
            <p className="text-base font-semibold tracking-tight">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <span className="text-lg font-semibold tracking-tight">R$ {amount}</span>
          {onDelete ? (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ObligationDialog({
  open,
  mode,
  onOpenChange,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  mode: DialogMode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SimpleFormState) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<SimpleFormState>({
    title: "",
    amount: "",
    dueDate: ymd(new Date()),
    notes: "",
  });

  const meta = mode ? sectionMeta(mode) : null;

  async function handleSubmit() {
    if (!form.title || !form.amount) {
      toast.error("Preencha pelo menos nome e valor.");
      return;
    }

    await onSubmit(form);
    setForm({
      title: "",
      amount: "",
      dueDate: ymd(new Date()),
      notes: "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meta ? meta.button : "Novo cadastro"}</DialogTitle>
          <DialogDescription>
            Nesta fase inicial de Obrigações, o foco é um cadastro simples e confiável, sem filtros avançados na experiência visual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Fornecedor de embalagem" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalhes opcionais para facilitar a leitura da listagem" rows={4} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Obligations() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const now = new Date();
  const [selectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear] = useState(now.getFullYear());
  const [activeSection, setActiveSection] = useState<ObligationSection>("payables");
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const cnpjs = cnpjsQuery.data ?? [];
  const fallbackCnpjId = cnpjs[0]?.id ? Number(cnpjs[0].id) : undefined;

  const payablesQuery = trpc.finance.payables.list.useQuery(
    fallbackCnpjId ? { year: selectedYear, month: selectedMonth, cnpjId: fallbackCnpjId } : { year: selectedYear, month: selectedMonth },
    { enabled: true },
  );
  const fixedCostsQuery = trpc.finance.fixedCosts.list.useQuery(
    fallbackCnpjId ? { cnpjId: fallbackCnpjId } : { cnpjId: 1 },
    { enabled: Boolean(fallbackCnpjId) },
  );
  const fixedCostPaymentsQuery = trpc.finance.fixedCosts.payments.useQuery(
    fallbackCnpjId ? { year: selectedYear, month: selectedMonth, cnpjId: fallbackCnpjId } : { year: selectedYear, month: selectedMonth, cnpjId: 1 },
    { enabled: Boolean(fallbackCnpjId) },
  );
  const creditCardsQuery = trpc.finance.creditCards.list.useQuery(
    fallbackCnpjId ? { cnpjId: fallbackCnpjId } : { cnpjId: 1 },
    { enabled: Boolean(fallbackCnpjId) },
  );
  const loansQuery = trpc.finance.loans.list.useQuery(
    fallbackCnpjId ? { cnpjId: fallbackCnpjId } : { cnpjId: 1 },
    { enabled: Boolean(fallbackCnpjId) },
  );

  const createPayableMutation = trpc.finance.payables.create.useMutation();
  const deletePayableMutation = trpc.finance.payables.delete.useMutation();
  const createFixedCostMutation = trpc.finance.fixedCosts.create.useMutation();
  const deleteFixedCostMutation = trpc.finance.fixedCosts.delete.useMutation();
  const createCreditCardMutation = trpc.finance.creditCards.create.useMutation();
  const deleteCreditCardMutation = trpc.finance.creditCards.delete.useMutation();
  const createLoanMutation = trpc.finance.loans.create.useMutation();
  const deleteLoanMutation = trpc.finance.loans.delete.useMutation();

  const payables = payablesQuery.data ?? [];
  const fixedCosts = fixedCostsQuery.data ?? [];
  const fixedCostPayments = fixedCostPaymentsQuery.data ?? [];
  const creditCards = creditCardsQuery.data ?? [];
  const loans = loansQuery.data ?? [];

  const fixedCostsVisible = useMemo(() => {
    const paidIds = new Set((fixedCostPayments ?? []).map((item: any) => Number(item.fixedCostId || item.payment?.fixedCostId || item.fixedCost?.id || 0)));
    const projected = fixedCosts
      .filter((item: any) => !paidIds.has(Number(item.id)))
      .map((item: any) => ({
        id: `fixed-${item.id}`,
        fixedCostId: item.id,
        name: item.name,
        amount: item.amount,
        notes: item.notes,
        dueDate: ymd(new Date(selectedYear, selectedMonth - 1, 1)),
        statusLabel: "Cadastro ativo",
      }));

    const monthly = (fixedCostPayments ?? []).map((item: any) => ({
      id: `payment-${item.id}`,
      fixedCostId: item.fixedCostId || item.payment?.fixedCostId || item.fixedCost?.id,
      name: item.fixedCost?.name || item.name || "Custo fixo",
      amount: item.amountPaid || item.amount || item.payment?.amountPaid,
      notes: item.fixedCost?.notes || item.notes || item.payment?.notes,
      dueDate: `${String(item.referenceYear || selectedYear)}-${String(item.referenceMonth || selectedMonth).padStart(2, "0")}-01`,
      statusLabel: "Pagamento do período",
    }));

    return [...monthly, ...projected];
  }, [fixedCosts, fixedCostPayments, selectedMonth, selectedYear]);

  const sections = ["payables", "fixed-costs", "credit-cards", "loans"] as const;

  const metrics = {
    payables: payables.length,
    fixedCosts: fixedCostsVisible.length,
    creditCards: creditCards.length,
    loans: loans.length,
  };

  async function refreshAll() {
    await Promise.all([
      payablesQuery.refetch(),
      fixedCostsQuery.refetch(),
      fixedCostPaymentsQuery.refetch(),
      creditCardsQuery.refetch(),
      loansQuery.refetch(),
    ]);
  }

  async function handleCreate(payload: SimpleFormState) {
    if (!dialogMode) return;
    if (!fallbackCnpjId) {
      toast.error("Cadastre ao menos um CNPJ para usar esta primeira versão de Obrigações.");
      return;
    }

    if (dialogMode === "payables") {
      await createPayableMutation.mutateAsync({
        cnpjId: fallbackCnpjId,
        title: payload.title,
        supplier: payload.title,
        amount: payload.amount,
        dueDate: payload.dueDate,
        category: "financeiro",
        notes: payload.notes || null,
      });
      toast.success("Conta salva e recarregada na listagem.");
    }

    if (dialogMode === "fixed-costs") {
      await createFixedCostMutation.mutateAsync({
        cnpjId: fallbackCnpjId,
        name: payload.title,
        amount: payload.amount,
        dueDay: 1,
        category: "operacional",
        notes: payload.notes || null,
      });
      toast.success("Custo fixo salvo e recarregado na listagem.");
    }

    if (dialogMode === "credit-cards") {
      await createCreditCardMutation.mutateAsync({
        cnpjId: fallbackCnpjId,
        name: payload.title,
        brand: payload.notes || "outros",
        closingDay: 1,
        dueDay: 10,
        creditLimit: payload.amount,
        notes: payload.notes || null,
      });
      toast.success("Cartão salvo e recarregado na listagem.");
    }

    if (dialogMode === "loans") {
      await createLoanMutation.mutateAsync({
        cnpjId: fallbackCnpjId,
        name: payload.title,
        institution: payload.notes || "Instituição não informada",
        totalAmount: payload.amount,
        startDate: payload.dueDate,
        loanType: "installment",
        totalInstallments: 1,
      });
      toast.success("Empréstimo salvo e recarregado na listagem.");
    }

    await refreshAll();
    setDialogOpen(false);
    setDialogMode(null);
  }

  async function handleDelete(section: ObligationSection, id: number) {
    const confirmed = window.confirm("Deseja realmente excluir este item?");
    if (!confirmed) return;

    if (section === "payables") await deletePayableMutation.mutateAsync({ id });
    if (section === "fixed-costs") await deleteFixedCostMutation.mutateAsync({ id });
    if (section === "credit-cards") await deleteCreditCardMutation.mutateAsync({ id });
    if (section === "loans") await deleteLoanMutation.mutateAsync({ id });

    toast.success("Item excluído com sucesso.");
    await refreshAll();
  }

  const currentMeta = sectionMeta(activeSection);
  const CurrentIcon = currentMeta.icon;

  if (!user) return null;

  return (
    <DashboardLayout activeSection="obrigacoes" onNavigate={(section) => navigate(`/${section}`)}>
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[2rem] border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <Badge variant="secondary" className="w-fit bg-white/10 text-white hover:bg-white/10">Obrigações</Badge>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">Nova base de Obrigações para validar o fluxo</h1>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    Esta reconstrução fica separada do Financeiro principal, com foco em cadastro simples, listagem direta e atualização imediata da tela.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => { setDialogMode(activeSection); setDialogOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4" />
                  {currentMeta.button}
                </Button>
                <Button variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => refreshAll()}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Atualizar tela
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sections.map((section) => {
            const meta = sectionMeta(section);
            const Icon = meta.icon;
            const active = activeSection === section;
            const count = section === "payables" ? metrics.payables : section === "fixed-costs" ? metrics.fixedCosts : section === "credit-cards" ? metrics.creditCards : metrics.loans;
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`rounded-3xl border p-4 text-left shadow-sm transition-all ${active ? "border-slate-900 bg-slate-900 text-white" : "border-border bg-card hover:-translate-y-0.5 hover:shadow-md"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${active ? "text-white/70" : "text-muted-foreground"}`}>Categoria</p>
                    <p className="mt-3 text-lg font-semibold tracking-tight">{meta.label}</p>
                    <p className={`mt-2 text-sm ${active ? "text-white/75" : "text-muted-foreground"}`}>{meta.description}</p>
                  </div>
                  <div className={`rounded-2xl p-3 ${active ? "bg-white/10" : "bg-muted"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4 text-sm font-medium">{count} item(ns) visíveis</div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[2rem] border bg-card/95 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-3 text-2xl tracking-tight">
                    <div className={`rounded-2xl bg-gradient-to-br p-3 text-white ${currentMeta.accent}`}>
                      <CurrentIcon className="h-5 w-5" />
                    </div>
                    {currentMeta.label}
                  </CardTitle>
                  <CardDescription className="mt-2 text-sm">{currentMeta.description}</CardDescription>
                </div>
                <Badge variant="outline">{MONTHS[selectedMonth - 1]} {selectedYear}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fluxo esperado</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Entrar na categoria, cadastrar, salvar e ver o item aparecer na listagem imediatamente.</p>
                </div>
                <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fase atual</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">O foco é confiabilidade básica do cadastro e da listagem, mantendo Obrigações separada do Financeiro principal.</p>
                </div>
              </div>

              <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 p-4">
                <p className="text-sm font-medium">Ações rápidas</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={() => { setDialogMode(activeSection); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    {currentMeta.button}
                  </Button>
                  <Button variant="outline" onClick={() => refreshAll()}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Recarregar dados
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>Listagem da categoria</CardTitle>
              <CardDescription>Os itens abaixo devem permanecer visíveis após o salvamento nesta nova versão de Obrigações.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeSection === "payables" && (payables.length > 0 ? payables.map((item: any) => (
                <ObligationRow
                  key={item.id}
                  title={item.title || item.description || item.supplier || "Conta a pagar"}
                  subtitle={`${item.notes || item.supplier || "Sem observações"} • vencimento ${item.dueDate || "não informado"}`}
                  amount={fmt(item.amount)}
                  badge={item.status || "pendente"}
                  onDelete={() => handleDelete("payables", Number(item.id))}
                />
              )) : (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  Nenhuma conta a pagar cadastrada neste período.
                </div>
              ))}

              {activeSection === "fixed-costs" && (fixedCostsVisible.length > 0 ? fixedCostsVisible.map((item: any) => (
                <ObligationRow
                  key={item.id}
                  title={item.name || "Custo fixo"}
                  subtitle={`${item.notes || "Sem observações"} • referência ${item.dueDate || "não informada"}`}
                  amount={fmt(item.amount)}
                  badge={item.statusLabel || "ativo"}
                  onDelete={() => handleDelete("fixed-costs", Number(item.fixedCostId || String(item.id).replace("fixed-", "")))}
                />
              )) : (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  Nenhum custo fixo cadastrado.
                </div>
              ))}

              {activeSection === "credit-cards" && (creditCards.length > 0 ? creditCards.map((item: any) => (
                <ObligationRow
                  key={item.id}
                  title={item.name || "Cartão"}
                  subtitle={`${item.bankName || item.brand || "Banco não informado"} • fechamento ${item.closingDay || 1} / vencimento ${item.dueDay || 10}`}
                  amount={fmt(item.limitAmount || item.creditLimit)}
                  badge="cartão"
                  onDelete={() => handleDelete("credit-cards", Number(item.id))}
                />
              )) : (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  Nenhum cartão cadastrado.
                </div>
              ))}

              {activeSection === "loans" && (loans.length > 0 ? loans.map((item: any) => (
                <ObligationRow
                  key={item.id}
                  title={item.name || "Empréstimo"}
                  subtitle={`${item.institution || "Instituição não informada"} • tipo ${item.loanType || "não informado"}`}
                  amount={fmt(item.amount || item.totalAmount)}
                  badge="empréstimo"
                  onDelete={() => handleDelete("loans", Number(item.id))}
                />
              )) : (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  Nenhum empréstimo cadastrado.
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-3xl border bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Período</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{MONTHS[selectedMonth - 1]} de {selectedYear}</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Visíveis agora</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">
                {activeSection === "payables" ? metrics.payables : activeSection === "fixed-costs" ? metrics.fixedCosts : activeSection === "credit-cards" ? metrics.creditCards : metrics.loans}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Itens carregados na categoria selecionada.</p>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Observação desta fase</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">Depois de validar que salvar mantém o item visível, a próxima etapa poderá recolocar filtros e regras mais avançadas apenas dentro de Obrigações.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ObligationDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDialogMode(null);
        }}
        onSubmit={handleCreate}
        isSaving={createPayableMutation.isPending || createFixedCostMutation.isPending || createCreditCardMutation.isPending || createLoanMutation.isPending}
      />
    </DashboardLayout>
  );
}
