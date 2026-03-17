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
import { Loader2, UserPlus } from "lucide-react";
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
    toast.success(`Cliente ${customer.name} carregado para edição.`);
  }

  function startNewCustomer() {
    setSelectedCustomerId("new");
    setCustomerForm(createEmptyCustomerForm());
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
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl"><UserPlus className="h-5 w-5" /> Cadastro e busca de clientes</CardTitle>
              <CardDescription>Use este menu separado para cadastrar, localizar e revisar clientes sem misturar essa rotina com produtos e pedidos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                <Input
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Buscar cliente por nome, telefone ou referência"
                />
                <Button variant="outline" onClick={startNewCustomer}>Novo cliente</Button>
              </div>
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
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Dados do cliente</CardTitle>
              <CardDescription>Cadastre ou revise os dados do cliente selecionado em uma área dedicada só para isso.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={customerForm.name} onChange={e => setCustomerForm(current => ({ ...current, name: e.target.value }))} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-2">
                  <Label>Referência</Label>
                  <Input value={customerForm.reference} onChange={e => setCustomerForm(current => ({ ...current, reference: e.target.value }))} placeholder="Como você identifica esse cliente" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Documento</Label>
                  <Input value={customerForm.document} onChange={e => setCustomerForm(current => ({ ...current, document: e.target.value }))} placeholder="CPF ou CNPJ" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={customerForm.phone} onChange={e => setCustomerForm(current => ({ ...current, phone: e.target.value }))} placeholder="Telefone" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={customerForm.email} onChange={e => setCustomerForm(current => ({ ...current, email: e.target.value }))} placeholder="E-mail" />
                </div>
                <div className="space-y-2">
                  <Label>Cidade / Estado</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={customerForm.city} onChange={e => setCustomerForm(current => ({ ...current, city: e.target.value }))} placeholder="Cidade" />
                    <Input value={customerForm.state} onChange={e => setCustomerForm(current => ({ ...current, state: e.target.value }))} placeholder="UF" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações do cliente</Label>
                <Textarea value={customerForm.notes} onChange={e => setCustomerForm(current => ({ ...current, notes: e.target.value }))} rows={5} placeholder="Informações úteis sobre o cliente" />
              </div>
              <Button onClick={saveCustomer} disabled={createCustomerMutation.isPending}>
                {createCustomerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar cliente
              </Button>
              {selectedCustomer ? (
                <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                  Cliente em edição: <strong className="text-foreground">{selectedCustomer.name}</strong>
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                  Nenhum cliente selecionado. Você pode iniciar um novo cadastro ou escolher um registro da lista.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
