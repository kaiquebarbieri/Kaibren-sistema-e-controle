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
import { CalendarDays, CreditCard, Landmark, Plus, Receipt, RotateCcw, Trash2, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

type AccountsSection = "payables" | "credit-cards" | "loans";
type DialogMode = AccountsSection | null;

type FormState = {
  title: string;
  amount: string;
  dueDate: string;
  notes: string;
  secondaryValue: string;
  installments: string;
};

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function toCurrency(value: number | string | null | undefined): string {
  const parsed = Number(value || 0);
  return parsed.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getSectionMeta(section: AccountsSection) {
  const map = {
    payables: {
      label: "Contas a Pagar",
      description: "Cadastre boletos, dívidas da empresa, fornecedores, despesas a vencer e contas em atraso.",
      icon: Receipt,
      accent: "from-rose-500 via-pink-500 to-orange-400",
      button: "Nova conta a pagar",
      empty: "Nenhuma conta a pagar cadastrada neste período.",
      helperTitle: "Fluxo desta área",
      helperText: "Aqui você lança boletos, fornecedores, despesas a vencer e contas em atraso em uma lista direta e objetiva.",
    },
    "credit-cards": {
      label: "Cartão de Crédito",
      description: "Cadastre cartões, limite, vencimento, fechamento, valor de fatura, compras e parcelas.",
      icon: CreditCard,
      accent: "from-sky-500 via-blue-500 to-indigo-500",
      button: "Novo cartão",
      empty: "Nenhum cartão cadastrado.",
      helperTitle: "Controle de cartões",
      helperText: "Cada cartão fica em uma área própria para acompanhar limite, fechamento, vencimento e observações de uso.",
    },
    loans: {
      label: "Empréstimos",
      description: "Cadastre empréstimos, valor total, parcelas, vencimentos e saldo restante.",
      icon: Landmark,
      accent: "from-amber-500 via-orange-500 to-rose-500",
      button: "Novo empréstimo",
      empty: "Nenhum empréstimo cadastrado.",
      helperTitle: "Acompanhamento de parcelas",
      helperText: "Use esta área para manter empréstimos organizados com valor total, quantidade de parcelas e saldo restante visível.",
    },
  } satisfies Record<AccountsSection, {
    label: string;
    description: string;
    icon: any;
    accent: string;
    button: string;
    empty: string;
    helperTitle: string;
    helperText: string;
  }>;

  return map[section];
}

function AccountsRow({
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

function AccountsDialog({
  open,
  mode,
  onOpenChange,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  mode: DialogMode;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: FormState) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>({
    title: "",
    amount: "",
    dueDate: formatDate(new Date()),
    notes: "",
    secondaryValue: "",
    installments: "1",
  });

  const meta = mode ? getSectionMeta(mode) : null;

  async function handleSubmit() {
    if (!form.title || !form.amount) {
      toast.error("Preencha pelo menos nome e valor.");
      return;
    }

    await onSubmit(form);
    setForm({
      title: "",
      amount: "",
      dueDate: formatDate(new Date()),
      notes: "",
      secondaryValue: "",
      installments: "1",
    });
  }

  const isCard = mode === "credit-cards";
  const isLoan = mode === "loans";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{meta ? meta.button : "Novo cadastro"}</DialogTitle>
          <DialogDescription>
            Esta etapa foca em um cadastro simples e estável, com os campos principais visíveis logo no módulo Contas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{isCard ? "Nome do cartão" : isLoan ? "Nome do empréstimo" : "Título da conta"}</Label>
            <Input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={isCard ? "Ex.: Cartão Santander" : isLoan ? "Ex.: Capital de giro" : "Ex.: Boleto do fornecedor"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{isCard ? "Limite" : isLoan ? "Valor total" : "Valor"}</Label>
              <Input
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>{isCard ? "Vencimento" : "Data de referência"}</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
              />
            </div>
          </div>

          {(isCard || isLoan) ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{isCard ? "Fechamento ou fatura atual" : "Parcela"}</Label>
                <Input
                  value={form.secondaryValue}
                  onChange={(event) => setForm((current) => ({ ...current, secondaryValue: event.target.value }))}
                  placeholder={isCard ? "Ex.: Fecha dia 25 / fatura 1.980,00" : "Ex.: 1.250,00"}
                />
              </div>
              <div className="space-y-2">
                <Label>{isCard ? "Compras / parcelas" : "Quantidade de parcelas"}</Label>
                <Input
                  value={form.installments}
                  onChange={(event) => setForm((current) => ({ ...current, installments: event.target.value }))}
                  placeholder={isCard ? "Ex.: 8 compras / 3 parcelas" : "12"}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Detalhes opcionais para deixar a leitura da listagem mais clara"
              rows={4}
            />
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
  const [, params] = useRoute<{ tab?: string }>("/obrigacoes/:tab");
  const now = new Date();
  const [selectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear] = useState(now.getFullYear());
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const routeTab = params?.tab;
  const initialSection: AccountsSection = routeTab === "cartao-de-credito"
    ? "credit-cards"
    : routeTab === "emprestimos"
      ? "loans"
      : "payables";

  const [activeSection, setActiveSection] = useState<AccountsSection>(initialSection);

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();
  const cnpjs = cnpjsQuery.data ?? [];
  const fallbackCnpjId = cnpjs[0]?.id ? Number(cnpjs[0].id) : undefined;

  const payablesQuery = trpc.finance.payables.list.useQuery(
    fallbackCnpjId ? { year: selectedYear, month: selectedMonth, cnpjId: fallbackCnpjId } : { year: selectedYear, month: selectedMonth },
    { enabled: true },
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
  const createCreditCardMutation = trpc.finance.creditCards.create.useMutation();
  const deleteCreditCardMutation = trpc.finance.creditCards.delete.useMutation();
  const createLoanMutation = trpc.finance.loans.create.useMutation();
  const deleteLoanMutation = trpc.finance.loans.delete.useMutation();

  const payables = payablesQuery.data ?? [];
  const creditCards = creditCardsQuery.data ?? [];
  const loans = loansQuery.data ?? [];

  const metrics = {
    payables: payables.length,
    creditCards: creditCards.length,
    loans: loans.length,
  };

  const sections: AccountsSection[] = ["payables", "credit-cards", "loans"];

  const currentMeta = useMemo(() => getSectionMeta(activeSection), [activeSection]);
  const CurrentIcon = currentMeta.icon;

  function navigateToSection(section: AccountsSection) {
    setActiveSection(section);
    const href = section === "credit-cards"
      ? "/obrigacoes/cartao-de-credito"
      : section === "loans"
        ? "/obrigacoes/emprestimos"
        : "/obrigacoes/contas-a-pagar";
    navigate(href);
  }

  async function refreshAll() {
    await Promise.all([
      payablesQuery.refetch(),
      creditCardsQuery.refetch(),
      loansQuery.refetch(),
    ]);
  }

  async function handleCreate(payload: FormState) {
    if (!dialogMode) return;
    if (!fallbackCnpjId) {
      toast.error("Cadastre ao menos um CNPJ para usar este módulo.");
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
      toast.success("Conta a pagar salva e exibida na listagem.");
    }

    if (dialogMode === "credit-cards") {
      await createCreditCardMutation.mutateAsync({
        cnpjId: fallbackCnpjId,
        name: payload.title,
        brand: payload.notes || payload.secondaryValue || "outros",
        closingDay: 1,
        dueDay: 10,
        creditLimit: payload.amount,
        notes: [payload.secondaryValue, payload.installments, payload.notes].filter(Boolean).join(" • ") || null,
      });
      toast.success("Cartão salvo e exibido na listagem.");
    }

    if (dialogMode === "loans") {
      await createLoanMutation.mutateAsync({
        cnpjId: fallbackCnpjId,
        name: payload.title,
        institution: payload.notes || "Instituição não informada",
        totalAmount: payload.amount,
        startDate: payload.dueDate,
        loanType: "installment",
        totalInstallments: Number(payload.installments || 1),
      });
      toast.success("Empréstimo salvo e exibido na listagem.");
    }

    await refreshAll();
    setDialogOpen(false);
    setDialogMode(null);
  }

  async function handleDelete(section: AccountsSection, id: number) {
    const confirmed = window.confirm("Deseja realmente excluir este item?");
    if (!confirmed) return;

    if (section === "payables") await deletePayableMutation.mutateAsync({ id });
    if (section === "credit-cards") await deleteCreditCardMutation.mutateAsync({ id });
    if (section === "loans") await deleteLoanMutation.mutateAsync({ id });

    toast.success("Item excluído com sucesso.");
    await refreshAll();
  }

  if (!user) return null;

  return (
    <DashboardLayout activeSection="obrigacoes" onNavigate={(section) => navigate(`/${section}`)}>
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[2rem] border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <Badge variant="secondary" className="w-fit bg-white/10 text-white hover:bg-white/10">Contas</Badge>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight">Módulo Contas com navegação clara e separada</h1>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    Esta área foi organizada para funcionar como um módulo real do sistema, com três submenus fixos: Contas a Pagar, Cartão de Crédito e Empréstimos.
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

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-[2rem] border bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <WalletCards className="h-5 w-5 text-primary" />
                Contas
              </CardTitle>
              <CardDescription>
                Selecione abaixo o submenu que deseja usar dentro do módulo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sections.map((section) => {
                const meta = getSectionMeta(section);
                const Icon = meta.icon;
                const isActive = activeSection === section;
                const count = section === "payables" ? metrics.payables : section === "credit-cards" ? metrics.creditCards : metrics.loans;
                return (
                  <button
                    key={section}
                    onClick={() => navigateToSection(section)}
                    className={`w-full rounded-3xl border p-4 text-left shadow-sm transition-all ${isActive ? "border-slate-900 bg-slate-900 text-white" : "border-border bg-card hover:-translate-y-0.5 hover:shadow-md"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isActive ? "text-white/70" : "text-muted-foreground"}`}>Submenu</p>
                        <p className="mt-3 text-lg font-semibold tracking-tight">{meta.label}</p>
                        <p className={`mt-2 text-sm leading-6 ${isActive ? "text-white/75" : "text-muted-foreground"}`}>{meta.description}</p>
                      </div>
                      <div className={`rounded-2xl p-3 ${isActive ? "bg-white/10" : "bg-muted"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 text-sm font-medium">{count} item(ns) visíveis</div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[2rem] border bg-card/95 shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-2xl tracking-tight">
                      <div className={`rounded-2xl bg-gradient-to-br p-3 text-white ${currentMeta.accent}`}>
                        <CurrentIcon className="h-5 w-5" />
                      </div>
                      {currentMeta.label}
                    </CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6">{currentMeta.description}</CardDescription>
                  </div>
                  <Badge variant="outline">{MONTHS[selectedMonth - 1]} {selectedYear}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{currentMeta.helperTitle}</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{currentMeta.helperText}</p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fluxo esperado</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">Entrar no submenu, cadastrar, salvar e ver o item aparecer imediatamente na listagem sem sumir da tela.</p>
                  </div>
                  <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Itens visíveis</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight">
                      {activeSection === "payables" ? metrics.payables : activeSection === "credit-cards" ? metrics.creditCards : metrics.loans}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">Quantidade carregada no submenu atual.</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-dashed border-border/70 bg-background/70 p-4">
                  <p className="text-sm font-medium">Ações rápidas do submenu</p>
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
                <CardTitle>Listagem do submenu</CardTitle>
                <CardDescription>Os itens abaixo devem aparecer e permanecer visíveis após o cadastro nesta fase de validação.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeSection === "payables" && (payables.length > 0 ? payables.map((item: any) => (
                  <AccountsRow
                    key={item.id}
                    title={item.title || item.description || item.supplier || "Conta a pagar"}
                    subtitle={`${item.notes || item.supplier || "Sem observações"} • vencimento ${item.dueDate || "não informado"}`}
                    amount={toCurrency(item.amount)}
                    badge={item.status || "pendente"}
                    onDelete={() => handleDelete("payables", Number(item.id))}
                  />
                )) : (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    {getSectionMeta("payables").empty}
                  </div>
                ))}

                {activeSection === "credit-cards" && (creditCards.length > 0 ? creditCards.map((item: any) => (
                  <AccountsRow
                    key={item.id}
                    title={item.name || "Cartão"}
                    subtitle={`${item.bankName || item.brand || "Banco não informado"} • fechamento ${item.closingDay || 1} / vencimento ${item.dueDay || 10}`}
                    amount={toCurrency(item.limitAmount || item.creditLimit)}
                    badge="cartão"
                    onDelete={() => handleDelete("credit-cards", Number(item.id))}
                  />
                )) : (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    {getSectionMeta("credit-cards").empty}
                  </div>
                ))}

                {activeSection === "loans" && (loans.length > 0 ? loans.map((item: any) => (
                  <AccountsRow
                    key={item.id}
                    title={item.name || "Empréstimo"}
                    subtitle={`${item.institution || "Instituição não informada"} • parcelas ${item.totalInstallments || 1}`}
                    amount={toCurrency(item.amount || item.totalAmount)}
                    badge="empréstimo"
                    onDelete={() => handleDelete("loans", Number(item.id))}
                  />
                )) : (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    {getSectionMeta("loans").empty}
                  </div>
                ))}
              </CardContent>
            </Card>

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
                  <CardTitle className="text-base">Estrutura aprovada</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">Este módulo usa apenas os submenus Contas a Pagar, Cartão de Crédito e Empréstimos.</p>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border bg-card/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Escopo desta etapa</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">Custos Fixos não entram nesta estrutura e o Financeiro antigo continua separado desta área.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <AccountsDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDialogMode(null);
        }}
        onSubmit={handleCreate}
        isSaving={createPayableMutation.isPending || createCreditCardMutation.isPending || createLoanMutation.isPending}
      />
    </DashboardLayout>
  );
}
