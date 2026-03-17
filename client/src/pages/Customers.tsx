import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, UserPlus, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type CustomerRow = {
  id: number;
  name: string;
  reference: string | null;
  document: string | null;
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
    phone: "",
    email: "",
    city: "",
    state: "",
    notes: "",
  };
}

export default function Customers() {
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("new");
  const [customerForm, setCustomerForm] = useState<CustomerForm>(() => createEmptyCustomerForm());
  const [showForm, setShowForm] = useState(false);

  const customersQuery = trpc.customers.search.useQuery({
    query: customerSearch,
    limit: 100,
  });

  const createCustomerMutation = trpc.customers.create.useMutation({
    onSuccess: async customer => {
      if (!customer) return;
      toast.success(`Cliente ${customer.name} cadastrado com sucesso.`);
      setSelectedCustomerId(String(customer.id));
      setCustomerForm({
        name: customer.name,
        reference: customer.reference ?? "",
        document: customer.document ?? "",
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        city: customer.city ?? "",
        state: customer.state ?? "",
        notes: customer.notes ?? "",
      });
      setCustomerSearch(customer.name);
      setShowForm(false);
      await customersQuery.refetch();
    },
    onError: error => toast.error(error.message),
  });

  const selectedCustomer = useMemo(() => {
    return (customersQuery.data ?? []).find(customer => String(customer.id) === selectedCustomerId) ?? null;
  }, [customersQuery.data, selectedCustomerId]);

  function applyCustomer(customer: CustomerRow) {
    setSelectedCustomerId(String(customer.id));
    setCustomerForm({
      name: customer.name,
      reference: customer.reference ?? "",
      document: customer.document ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      notes: customer.notes ?? "",
    });
    setShowForm(true);
    toast.success(`Cliente ${customer.name} carregado para edição.`);
  }

  function startNewCustomer() {
    setSelectedCustomerId("new");
    setCustomerForm(createEmptyCustomerForm());
    setShowForm(true);
    toast.success("Cadastro manual de cliente liberado.");
  }

  async function saveCustomer() {
    if (!customerForm.name.trim()) {
      toast.error("Informe o nome do cliente para cadastrar.");
      return;
    }

    await createCustomerMutation.mutateAsync({
      name: customerForm.name,
      reference: customerForm.reference || null,
      document: customerForm.document || null,
      phone: customerForm.phone || null,
      email: customerForm.email || null,
      city: customerForm.city || null,
      state: customerForm.state || null,
      notes: customerForm.notes || null,
    });
  }

  return (
    <DashboardLayout activeSection="clientes">
      <div className="space-y-4 sm:space-y-6">
        {/* Mobile: stacked layout / Desktop: side by side */}
        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" /> Clientes
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Cadastre, busque e gerencie seus clientes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <div className="flex gap-2">
                <Input
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="h-10 sm:h-10 text-sm"
                />
                <Button
                  variant="outline"
                  onClick={startNewCustomer}
                  className="shrink-0 h-10 text-sm px-3 sm:px-4"
                >
                  Novo
                </Button>
              </div>

              {/* Mobile: card list / Desktop: table */}
              <div className="lg:hidden">
                <ScrollArea className="h-[360px]">
                  <div className="space-y-2">
                    {(customersQuery.data ?? []).map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => applyCustomer(customer as CustomerRow)}
                        className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:bg-accent/50 active:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">{customer.name}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground truncate">
                            {customer.phone ?? customer.reference ?? "Sem informação adicional"}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground ml-2" />
                      </button>
                    ))}
                    {(customersQuery.data ?? []).length === 0 && (
                      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                        Nenhum cliente encontrado.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="hidden lg:block">
                <ScrollArea className="h-[420px] rounded-2xl border border-border/60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Referência</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(customersQuery.data ?? []).map(customer => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.reference ?? "-"}</TableCell>
                          <TableCell>{customer.phone ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => applyCustomer(customer as CustomerRow)}>
                              Editar cadastro
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          {/* Form card - on mobile, show/hide with toggle */}
          <Card className={`border-border/60 shadow-sm ${!showForm ? "hidden lg:block" : ""}`}>
            <CardHeader className="px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg sm:text-xl">Dados do cliente</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    {selectedCustomer ? `Editando: ${selectedCustomer.name}` : "Cadastre um novo cliente."}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden text-xs"
                  onClick={() => setShowForm(false)}
                >
                  Fechar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Nome</Label>
                  <Input
                    value={customerForm.name}
                    onChange={e => setCustomerForm(current => ({ ...current, name: e.target.value }))}
                    placeholder="Nome do cliente"
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Referência</Label>
                  <Input
                    value={customerForm.reference}
                    onChange={e => setCustomerForm(current => ({ ...current, reference: e.target.value }))}
                    placeholder="Como identifica esse cliente"
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Documento</Label>
                  <Input
                    value={customerForm.document}
                    onChange={e => setCustomerForm(current => ({ ...current, document: e.target.value }))}
                    placeholder="CPF ou CNPJ"
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Telefone</Label>
                  <Input
                    value={customerForm.phone}
                    onChange={e => setCustomerForm(current => ({ ...current, phone: e.target.value }))}
                    placeholder="Telefone"
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">E-mail</Label>
                  <Input
                    value={customerForm.email}
                    onChange={e => setCustomerForm(current => ({ ...current, email: e.target.value }))}
                    placeholder="E-mail"
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Cidade / Estado</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={customerForm.city}
                      onChange={e => setCustomerForm(current => ({ ...current, city: e.target.value }))}
                      placeholder="Cidade"
                      className="h-10 text-sm"
                    />
                    <Input
                      value={customerForm.state}
                      onChange={e => setCustomerForm(current => ({ ...current, state: e.target.value }))}
                      placeholder="UF"
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Observações</Label>
                <Textarea
                  value={customerForm.notes}
                  onChange={e => setCustomerForm(current => ({ ...current, notes: e.target.value }))}
                  rows={3}
                  placeholder="Informações úteis sobre o cliente"
                  className="text-sm"
                />
              </div>
              <Button
                onClick={saveCustomer}
                disabled={createCustomerMutation.isPending}
                className="w-full h-11 text-sm font-medium"
              >
                {createCustomerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar cliente
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
