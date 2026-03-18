import { useMemo, useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  DollarSign,
  Loader2,
  MapPin,
  Mail,
  Phone,
  FileText,
  Search,
  ShoppingBag,
  Trophy,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
  Pencil,
  Save,
  User,
  Building2,
  StickyNote,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

type CustomerRow = {
  id: number;
  name: string;
  reference: string | null;
  document: string | null;
  inscricaoEstadual: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

type CustomerForm = {
  name: string;
  reference: string;
  document: string;
  inscricaoEstadual: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  notes: string;
};

function createEmptyCustomerForm(): CustomerForm {
  return {
    name: "",
    reference: "",
    document: "",
    inscricaoEstadual: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    notes: "",
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();
}

const avatarColors = [
  "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  "bg-blue-500/15 text-blue-600 border-blue-500/20",
  "bg-purple-500/15 text-purple-600 border-purple-500/20",
  "bg-amber-500/15 text-amber-600 border-amber-500/20",
  "bg-rose-500/15 text-rose-600 border-rose-500/20",
  "bg-cyan-500/15 text-cyan-600 border-cyan-500/20",
  "bg-indigo-500/15 text-indigo-600 border-indigo-500/20",
  "bg-orange-500/15 text-orange-600 border-orange-500/20",
];

function getAvatarColor(id: number) {
  return avatarColors[id % avatarColors.length];
}

/* ── Views ──────────────────────────────────────────── */

type View = "list" | "form" | "detail";

export default function Customers() {
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("new");
  const [customerForm, setCustomerForm] = useState<CustomerForm>(() => createEmptyCustomerForm());
  const [view, setView] = useState<View>("list");

  const now = useMemo(() => new Date(), []);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const customersQuery = trpc.customers.search.useQuery({
    query: customerSearch,
    limit: 100,
  });

  const countQuery = trpc.customers.count.useQuery();
  const rankingQuery = trpc.customers.ranking.useQuery({
    periodYear: currentYear,
    periodMonth: currentMonth,
    limit: 5,
  });
  const cnpjRankingQuery = trpc.myCnpjs.ranking.useQuery({
    periodYear: currentYear,
    periodMonth: currentMonth,
  });

  const createCustomerMutation = trpc.customers.create.useMutation({
    onSuccess: async customer => {
      if (!customer) return;
      toast.success(`Cliente ${customer.name} cadastrado com sucesso!`);
      setSelectedCustomerId(String(customer.id));
      setCustomerForm({
        name: customer.name,
        reference: customer.reference ?? "",
        document: customer.document ?? "",
        inscricaoEstadual: (customer as any).inscricaoEstadual ?? "",
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        notes: customer.notes ?? "",
      });
      setCustomerSearch("");
      setView("list");
      await customersQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const customers = customersQuery.data ?? [];

  const selectedCustomer = useMemo(() => {
    return customers.find(c => String(c.id) === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  function openDetail(customer: CustomerRow) {
    setSelectedCustomerId(String(customer.id));
    setCustomerForm({
      name: customer.name,
      reference: customer.reference ?? "",
      document: customer.document ?? "",
      inscricaoEstadual: customer.inscricaoEstadual ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      notes: customer.notes ?? "",
    });
    setView("detail");
  }

  function startEdit(customer?: CustomerRow) {
    if (customer) {
      setSelectedCustomerId(String(customer.id));
      setCustomerForm({
        name: customer.name,
        reference: customer.reference ?? "",
        document: customer.document ?? "",
        inscricaoEstadual: customer.inscricaoEstadual ?? "",
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        notes: customer.notes ?? "",
      });
    } else {
      setSelectedCustomerId("new");
      setCustomerForm(createEmptyCustomerForm());
    }
    setView("form");
  }

  const updateCustomerMutation = trpc.customers.update.useMutation({
    onSuccess: async (customer) => {
      if (!customer) return;
      toast.success(`Cliente ${customer.name} atualizado com sucesso!`);
      setView("list");
      await customersQuery.refetch();
      countQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteCustomerMutation = trpc.customers.delete.useMutation({
    onSuccess: async () => {
      toast.success("Cliente excluído com sucesso!");
      setView("list");
      setSelectedCustomerId("new");
      await customersQuery.refetch();
      countQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  /* ── CNPJ Management State ─────────────────────── */
  const [showCnpjSection, setShowCnpjSection] = useState(false);
  const [cnpjForm, setCnpjForm] = useState({ razaoSocial: "", cnpj: "", nomeFantasia: "", inscricaoEstadual: "", notes: "" });
  const [editingCnpjId, setEditingCnpjId] = useState<number | null>(null);
  const [showCnpjDeleteConfirm, setShowCnpjDeleteConfirm] = useState<number | null>(null);

  const cnpjsQuery = trpc.myCnpjs.list.useQuery();

  const createCnpjMutation = trpc.myCnpjs.create.useMutation({
    onSuccess: async () => {
      toast.success("CNPJ cadastrado com sucesso!");
      setCnpjForm({ razaoSocial: "", cnpj: "", nomeFantasia: "", inscricaoEstadual: "", notes: "" });
      await cnpjsQuery.refetch();
      cnpjRankingQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateCnpjMutation = trpc.myCnpjs.update.useMutation({
    onSuccess: async () => {
      toast.success("CNPJ atualizado com sucesso!");
      setEditingCnpjId(null);
      setCnpjForm({ razaoSocial: "", cnpj: "", nomeFantasia: "", inscricaoEstadual: "", notes: "" });
      await cnpjsQuery.refetch();
      cnpjRankingQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteCnpjMutation = trpc.myCnpjs.delete.useMutation({
    onSuccess: async () => {
      toast.success("CNPJ exclu\u00eddo com sucesso!");
      setShowCnpjDeleteConfirm(null);
      await cnpjsQuery.refetch();
      cnpjRankingQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const saveCnpj = useCallback(async () => {
    if (!cnpjForm.razaoSocial.trim() || !cnpjForm.cnpj.trim()) {
      toast.error("Informe a Raz\u00e3o Social e o CNPJ.");
      return;
    }
    if (editingCnpjId) {
      await updateCnpjMutation.mutateAsync({
        id: editingCnpjId,
        razaoSocial: cnpjForm.razaoSocial,
        cnpj: cnpjForm.cnpj,
        nomeFantasia: cnpjForm.nomeFantasia || null,
        inscricaoEstadual: cnpjForm.inscricaoEstadual || null,
        notes: cnpjForm.notes || null,
      });
    } else {
      await createCnpjMutation.mutateAsync({
        razaoSocial: cnpjForm.razaoSocial,
        cnpj: cnpjForm.cnpj,
        nomeFantasia: cnpjForm.nomeFantasia || null,
        inscricaoEstadual: cnpjForm.inscricaoEstadual || null,
        notes: cnpjForm.notes || null,
      });
    }
  }, [cnpjForm, editingCnpjId]);

  function startEditCnpj(cnpj: any) {
    setEditingCnpjId(cnpj.id);
    setCnpjForm({
      razaoSocial: cnpj.razaoSocial,
      cnpj: cnpj.cnpj,
      nomeFantasia: cnpj.nomeFantasia ?? "",
      inscricaoEstadual: cnpj.inscricaoEstadual ?? "",
      notes: cnpj.notes ?? "",
    });
    setShowCnpjSection(true);
  }

  function cancelEditCnpj() {
    setEditingCnpjId(null);
    setCnpjForm({ razaoSocial: "", cnpj: "", nomeFantasia: "", inscricaoEstadual: "", notes: "" });
  }

  async function saveCustomer() {
    if (!customerForm.name.trim()) {
      toast.error("Informe o nome do cliente para cadastrar.");
      return;
    }

    const data = {
      name: customerForm.name,
      reference: customerForm.reference || null,
      document: customerForm.document || null,
      inscricaoEstadual: customerForm.inscricaoEstadual || null,
      phone: customerForm.phone || null,
      email: customerForm.email || null,
      city: customerForm.city || null,
      state: customerForm.state || null,
      notes: customerForm.notes || null,
    };

    if (selectedCustomerId !== "new") {
      await updateCustomerMutation.mutateAsync({ id: Number(selectedCustomerId), ...data });
    } else {
      await createCustomerMutation.mutateAsync(data);
    }
  }

  async function handleDeleteCustomer() {
    if (selectedCustomerId === "new") return;
    await deleteCustomerMutation.mutateAsync({ id: Number(selectedCustomerId) });
    setShowDeleteConfirm(false);
  }

  function updateField(field: keyof CustomerForm, value: string) {
    setCustomerForm(prev => ({ ...prev, [field]: value }));
  }

  /* ── Customer List View ──────────────────────────── */
  function renderListView() {
    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              Clientes
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {customers.length} cliente{customers.length !== 1 ? "s" : ""} cadastrado{customers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button
            onClick={() => startEdit()}
            className="h-10 sm:h-11 gap-2 text-sm font-medium shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Novo cliente
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">Total clientes</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{countQuery.data ?? customers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ShoppingBag className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">Compraram este mês</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">{rankingQuery.data?.length ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ranking */}
        {(rankingQuery.data?.length ?? 0) > 0 && (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Ranking do mês</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 ml-auto">
                  {new Date().toLocaleString("pt-BR", { month: "long" }).replace(/^./, c => c.toUpperCase())}
                </Badge>
              </div>
              <div className="space-y-2">
                {rankingQuery.data?.map((r: any, i: number) => {
                  const medalColors = [
                    "bg-amber-500/15 text-amber-600 border-amber-500/20",
                    "bg-slate-400/15 text-slate-500 border-slate-400/20",
                    "bg-orange-600/15 text-orange-600 border-orange-600/20",
                  ];
                  const medalColor = i < 3 ? medalColors[i] : "bg-muted text-muted-foreground border-border/60";
                  return (
                    <div
                      key={r.customerId}
                      className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5 sm:p-3"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${medalColor}`}>
                        {i === 0 ? <Crown className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{r.customerName}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {r.totalPedidos} pedido{r.totalPedidos > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-600">
                          {Number(r.totalCompras).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                          <TrendingUp className="h-3 w-3" />
                          Lucro: {Number(r.totalLucro).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ranking de CNPJs */}
        {(cnpjRankingQuery.data?.length ?? 0) > 0 && (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-blue-500" />
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">Meus CNPJs - Compras do m\u00eas</h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 ml-auto">
                  {new Date().toLocaleString("pt-BR", { month: "long" }).replace(/^./, c => c.toUpperCase())}
                </Badge>
              </div>
              <div className="space-y-2">
                {cnpjRankingQuery.data?.map((r: any, i: number) => {
                  const colors = [
                    "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
                    "bg-blue-500/15 text-blue-600 border-blue-500/20",
                    "bg-orange-500/15 text-orange-600 border-orange-500/20",
                    "bg-purple-500/15 text-purple-600 border-purple-500/20",
                  ];
                  const color = colors[i % colors.length];
                  return (
                    <div key={r.cnpjId} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5 sm:p-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${color}`}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{r.nomeFantasia || r.razaoSocial}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {r.cnpj} &middot; {r.totalPedidos} pedido{r.totalPedidos > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-blue-600">
                          {Number(r.totalCompras).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meus CNPJs - Gerenciamento */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <button
              onClick={() => setShowCnpjSection(!showCnpjSection)}
              className="flex items-center gap-2 w-full text-left"
            >
              <Building2 className="h-4 w-4 text-blue-500" />
              <h3 className="text-xs sm:text-sm font-semibold text-foreground flex-1">Meus CNPJs</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {(cnpjsQuery.data ?? []).length} cadastrado{(cnpjsQuery.data ?? []).length !== 1 ? "s" : ""}
              </Badge>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showCnpjSection ? "rotate-90" : ""}`} />
            </button>

            {showCnpjSection && (
              <div className="mt-3 space-y-3">
                {/* Lista de CNPJs cadastrados */}
                {(cnpjsQuery.data ?? []).map((cnpj: any) => (
                  <div key={cnpj.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5 sm:p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-blue-500/15 text-blue-600 border-blue-500/20 text-xs font-bold">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{cnpj.nomeFantasia || cnpj.razaoSocial}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{cnpj.cnpj}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditCnpj(cnpj)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {showCnpjDeleteConfirm === cnpj.id ? (
                        <div className="flex gap-1">
                          <Button variant="destructive" size="sm" className="h-7 text-[10px] px-2" onClick={() => deleteCnpjMutation.mutate({ id: cnpj.id })} disabled={deleteCnpjMutation.isPending}>
                            Sim
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => setShowCnpjDeleteConfirm(null)}>
                            N\u00e3o
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setShowCnpjDeleteConfirm(cnpj.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Formulário de cadastro/edição */}
                <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
                  <p className="text-xs font-semibold text-foreground">{editingCnpjId ? "Editar CNPJ" : "Cadastrar novo CNPJ"}</p>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                    <Input
                      value={cnpjForm.razaoSocial}
                      onChange={e => setCnpjForm(f => ({ ...f, razaoSocial: e.target.value }))}
                      placeholder="Raz\u00e3o Social *"
                      className="h-9 text-sm rounded-lg"
                    />
                    <Input
                      value={cnpjForm.cnpj}
                      onChange={e => setCnpjForm(f => ({ ...f, cnpj: e.target.value }))}
                      placeholder="CNPJ *"
                      className="h-9 text-sm rounded-lg"
                    />
                    <Input
                      value={cnpjForm.nomeFantasia}
                      onChange={e => setCnpjForm(f => ({ ...f, nomeFantasia: e.target.value }))}
                      placeholder="Nome Fantasia"
                      className="h-9 text-sm rounded-lg"
                    />
                    <Input
                      value={cnpjForm.inscricaoEstadual}
                      onChange={e => setCnpjForm(f => ({ ...f, inscricaoEstadual: e.target.value }))}
                      placeholder="Inscri\u00e7\u00e3o Estadual"
                      className="h-9 text-sm rounded-lg"
                    />
                  </div>
                  <Input
                    value={cnpjForm.notes}
                    onChange={e => setCnpjForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Observa\u00e7\u00f5es (opcional)"
                    className="h-9 text-sm rounded-lg"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={saveCnpj}
                      disabled={createCnpjMutation.isPending || updateCnpjMutation.isPending}
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                    >
                      {(createCnpjMutation.isPending || updateCnpjMutation.isPending) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {editingCnpjId ? "Salvar" : "Cadastrar"}
                    </Button>
                    {editingCnpjId && (
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={cancelEditCnpj}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={customerSearch}
            onChange={e => setCustomerSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou referência..."
            className="h-11 pl-10 text-sm rounded-xl border-border/60 bg-card shadow-sm"
          />
          {customerSearch && (
            <button
              onClick={() => setCustomerSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Customer Cards */}
        {customersQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : customers.length === 0 ? (
          <Card className="border-dashed border-2 border-border/60 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-1">
                {customerSearch ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                {customerSearch
                  ? "Tente buscar com outro nome ou telefone."
                  : "Comece cadastrando seu primeiro cliente para gerenciar pedidos e campanhas."}
              </p>
              {!customerSearch && (
                <Button onClick={() => startEdit()} size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Cadastrar primeiro cliente
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-280px)] sm:h-[calc(100vh-260px)]">
            <div className="grid gap-2 sm:gap-3">
              {customers.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => openDetail(customer as CustomerRow)}
                  className="group flex items-center gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-border/60 bg-card p-3 sm:p-4 text-left transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.99]"
                >
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full border text-xs sm:text-sm font-bold ${getAvatarColor(customer.id)}`}>
                    {getInitials(customer.name)}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-medium text-foreground truncate">
                        {customer.name}
                      </span>
                      {customer.reference && (
                        <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] px-1.5 py-0 h-5">
                          {customer.reference}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {customer.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.city && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground hidden sm:flex">
                          <MapPin className="h-3 w-3" />
                          {customer.city}{customer.state ? `/${customer.state}` : ""}
                        </span>
                      )}
                      {!customer.phone && !customer.city && (
                        <span className="text-xs text-muted-foreground/60 italic">Sem informação adicional</span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  }

  /* ── Customer Detail View ────────────────────────── */
  function renderDetailView() {
    if (!selectedCustomer) return null;
    const c = selectedCustomer;

    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("list")}
            className="h-9 w-9 shrink-0 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground truncate">
              {c.name}
            </h1>
            {c.reference && (
              <p className="text-xs text-muted-foreground">{c.reference}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => startEdit(c as CustomerRow)}
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl h-9 text-xs sm:text-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl h-9 text-xs sm:text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <Card className="border-destructive/40 bg-destructive/5 shadow-sm">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-destructive mb-3">
                Tem certeza que deseja excluir o cliente <strong>{c.name}</strong>?
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Essa ação não pode ser desfeita. Os pedidos vinculados a este cliente serão mantidos.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteCustomer}
                  disabled={deleteCustomerMutation.isPending}
                  variant="destructive"
                  size="sm"
                  className="gap-1.5 rounded-xl h-9 text-xs"
                >
                  {deleteCustomerMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Sim, excluir
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-9 text-xs"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Card */}
        <Card className="border-border/60 shadow-sm overflow-hidden">
          {/* Colored top bar */}
          <div className="h-20 sm:h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent relative">
            <div className={`absolute -bottom-6 left-4 sm:left-6 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-4 border-card text-base sm:text-lg font-bold shadow-sm ${getAvatarColor(c.id)}`}>
              {getInitials(c.name)}
            </div>
          </div>

          <CardContent className="pt-10 sm:pt-12 pb-5 sm:pb-6 px-4 sm:px-6">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">{c.name}</h2>
            {c.reference && (
              <p className="text-sm text-muted-foreground mt-0.5">{c.reference}</p>
            )}

            {/* Info grid */}
            <div className="mt-5 sm:mt-6 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              {/* Phone */}
              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Phone className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">Telefone</p>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                    {c.phone || "Não informado"}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Mail className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">E-mail</p>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                    {c.email || "Não informado"}
                  </p>
                </div>
              </div>

              {/* Document */}
              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                  <FileText className="h-4 w-4 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">Documento</p>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                    {c.document || "Não informado"}
                  </p>
                </div>
              </div>

              {/* Inscrição Estadual */}
              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
                  <ClipboardList className="h-4 w-4 text-cyan-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">Inscrição Estadual</p>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                    {(c as any).inscricaoEstadual || "Não informado"}
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 sm:p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <MapPin className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">Localização</p>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">
                    {c.city ? `${c.city}${c.state ? ` / ${c.state}` : ""}` : "Não informado"}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {c.notes && (
              <div className="mt-4 sm:mt-5 rounded-xl bg-muted/50 p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">Observações</p>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{c.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Customer Form View ──────────────────────────── */
  function renderFormView() {
    const isNew = selectedCustomerId === "new";

    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("list")}
            className="h-9 w-9 shrink-0 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              {isNew ? "Novo cliente" : "Editar cliente"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isNew ? "Preencha os dados para cadastrar" : `Editando: ${customerForm.name}`}
            </p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-border/60 shadow-sm overflow-hidden">
          {/* Colored accent */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/30" />

          <CardContent className="pt-5 sm:pt-6 pb-5 sm:pb-6 px-4 sm:px-6 space-y-5 sm:space-y-6">
            {/* Section: Identificação */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <User className="h-3.5 w-3.5" />
                Identificação
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium">
                    Nome <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={customerForm.name}
                    onChange={e => updateField("name", e.target.value)}
                    placeholder="Nome completo do cliente"
                    className="h-11 text-sm rounded-xl"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium">Referência / Apelido</Label>
                  <Input
                    value={customerForm.reference}
                    onChange={e => updateField("reference", e.target.value)}
                    placeholder="Ex: Padaria do João, Mercado Central"
                    className="h-11 text-sm rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm font-medium">CPF / CNPJ</Label>
                <Input
                  value={customerForm.document}
                  onChange={e => updateField("document", e.target.value)}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="h-11 text-sm rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm font-medium">Inscrição Estadual</Label>
                <Input
                  value={customerForm.inscricaoEstadual}
                  onChange={e => updateField("inscricaoEstadual", e.target.value)}
                  placeholder="Número da inscrição estadual"
                  className="h-11 text-sm rounded-xl"
                />
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" />

            {/* Section: Contato */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <Phone className="h-3.5 w-3.5" />
                Contato
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium">WhatsApp / Telefone</Label>
                  <Input
                    value={customerForm.phone}
                    onChange={e => updateField("phone", e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-11 text-sm rounded-xl"
                    type="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium">E-mail</Label>
                  <Input
                    value={customerForm.email}
                    onChange={e => updateField("email", e.target.value)}
                    placeholder="cliente@email.com"
                    className="h-11 text-sm rounded-xl"
                    type="email"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" />

            {/* Section: Localização */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <Building2 className="h-3.5 w-3.5" />
                Localização
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-[1fr_80px] sm:grid-cols-[1fr_100px]">
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium">Cidade</Label>
                  <Input
                    value={customerForm.city}
                    onChange={e => updateField("city", e.target.value)}
                    placeholder="Nome da cidade"
                    className="h-11 text-sm rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium">UF</Label>
                  <Input
                    value={customerForm.state}
                    onChange={e => updateField("state", e.target.value)}
                    placeholder="SP"
                    className="h-11 text-sm rounded-xl"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border/60" />

            {/* Section: Observações */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider">
                <StickyNote className="h-3.5 w-3.5" />
                Observações
              </div>
              <Textarea
                value={customerForm.notes}
                onChange={e => updateField("notes", e.target.value)}
                rows={3}
                placeholder="Informações úteis sobre o cliente (ex: horário de entrega, preferências...)"
                className="text-sm rounded-xl resize-none"
              />
            </div>

            {/* Save button */}
            <Button
              onClick={saveCustomer}
              disabled={(createCustomerMutation.isPending || updateCustomerMutation.isPending) || !customerForm.name.trim()}
              className="w-full h-12 text-sm font-semibold rounded-xl gap-2 shadow-sm"
              size="lg"
            >
              {(createCustomerMutation.isPending || updateCustomerMutation.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isNew ? "Cadastrar cliente" : "Salvar alterações"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Main Render ─────────────────────────────────── */

  return (
    <DashboardLayout activeSection="clientes">
      <div className="max-w-3xl mx-auto">
        {view === "list" && renderListView()}
        {view === "detail" && renderDetailView()}
        {view === "form" && renderFormView()}
      </div>
    </DashboardLayout>
  );
}
