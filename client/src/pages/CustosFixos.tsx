import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Pencil, Trash2, Plus, CheckCircle2, XCircle } from "lucide-react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatCurrency(value: number) {
  return currency.format(value || 0);
}

type CustoFixo = {
  id: number;
  nome: string;
  valor: number;
  frequencia: string;
  categoria: string | null;
  ativo: boolean;
  observacao: string | null;
};

export default function CustosFixos() {
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<CustoFixo | null>(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [frequencia, setFrequencia] = useState("mensal");
  const [categoria, setCategoria] = useState("");
  const [observacao, setObservacao] = useState("");

  const { data, refetch } = trpc.listCustosFixos.useQuery();
  const criar = trpc.createCustoFixo.useMutation({ onSuccess: () => { refetch(); resetForm(); } });
  const atualizar = trpc.updateCustoFixo.useMutation({ onSuccess: () => { refetch(); resetForm(); } });
  const deletar = trpc.deleteCustoFixo.useMutation({ onSuccess: () => refetch() });
  const toggleAtivo = trpc.toggleCustoFixo.useMutation({ onSuccess: () => refetch() });

  function resetForm() {
    setFormOpen(false);
    setEditando(null);
    setNome("");
    setValor("");
    setFrequencia("mensal");
    setCategoria("");
    setObservacao("");
  }

  function abrirEdicao(c: CustoFixo) {
    setEditando(c);
    setNome(c.nome);
    setValor(String(c.valor));
    setFrequencia(c.frequencia);
    setCategoria(c.categoria || "");
    setObservacao(c.observacao || "");
    setFormOpen(true);
  }

  function salvar() {
    const v = parseFloat(valor.replace(",", "."));
    if (!nome || isNaN(v)) return;
    if (editando) {
      atualizar.mutate({ id: editando.id, nome, valor: v, frequencia, categoria: categoria || null, observacao: observacao || null });
    } else {
      criar.mutate({ nome, valor: v, frequencia, categoria: categoria || null, observacao: observacao || null });
    }
  }

  const custos: CustoFixo[] = (data as CustoFixo[] | undefined) || [];
  const ativos = custos.filter(c => c.ativo);
  const inativos = custos.filter(c => !c.ativo);
  const totalMensal = ativos.filter(c => c.frequencia === "mensal").reduce((s, c) => s + Number(c.valor), 0);
  const totalAnual = ativos.filter(c => c.frequencia === "anual").reduce((s, c) => s + Number(c.valor), 0);
  const totalGeral = totalMensal + totalAnual / 12;

  return (
    <DashboardLayout currentSection="custos-fixos">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Custos Fixos</h1>
            <p className="text-muted-foreground text-sm">Gerencie seus gastos recorrentes</p>
          </div>
          <Button onClick={() => { resetForm(); setFormOpen(true); }} className="gap-2">
            <Plus size={16} /> Novo Custo
          </Button>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground">Total Mensal</CardTitle></CardHeader>
            <CardContent className="pb-3 px-4"><p className="text-xl font-bold text-red-400">{formatCurrency(totalMensal)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground">Anuais (÷12)</CardTitle></CardHeader>
            <CardContent className="pb-3 px-4"><p className="text-xl font-bold text-amber-400">{formatCurrency(totalAnual / 12)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs text-muted-foreground">Custo Fixo/Mês</CardTitle></CardHeader>
            <CardContent className="pb-3 px-4"><p className="text-xl font-bold text-white">{formatCurrency(totalGeral)}</p></CardContent>
          </Card>
        </div>

        {/* Formulário */}
        {formOpen && (
          <Card className="border border-primary/40">
            <CardHeader><CardTitle className="text-base">{editando ? "Editar Custo" : "Novo Custo Fixo"}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input placeholder="Ex: Bling, Aluguel..." value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Valor (R$) *</Label>
                <Input placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Frequência</Label>
                <Select value={frequencia} onValueChange={setFrequencia}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="único">Único</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Input placeholder="Ex: Software, Aluguel, Folha..." value={categoria} onChange={e => setCategoria(e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Observação</Label>
                <Input placeholder="Opcional" value={observacao} onChange={e => setObservacao(e.target.value)} />
              </div>
              <div className="col-span-2 flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm}>Cancelar</Button>
                <Button onClick={salvar}>{editando ? "Salvar" : "Criar"}</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista Ativos */}
        <Card>
          <CardHeader><CardTitle className="text-base">Ativos ({ativos.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ativos.length === 0 && <p className="text-muted-foreground text-sm">Nenhum custo fixo cadastrado.</p>}
            {ativos.map(c => (
              <div key={c.id} className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm flex-1 min-w-0 truncate">{c.nome}</p>
                  <span className="font-bold text-red-400 text-sm ml-2 shrink-0">{formatCurrency(Number(c.valor))}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{c.frequencia}</Badge>
                    {c.categoria && <span className="text-xs text-muted-foreground">{c.categoria}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => abrirEdicao(c)}><Pencil size={13} /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleAtivo.mutate({ id: c.id, ativo: false })}><XCircle size={13} className="text-amber-400" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if(confirm(`Deletar "${c.nome}"?`)) deletar.mutate({ id: c.id }) }}><Trash2 size={13} className="text-red-500" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Lista Inativos */}
        {inativos.length > 0 && (
          <Card className="opacity-60">
            <CardHeader><CardTitle className="text-base text-muted-foreground">Inativos ({inativos.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {inativos.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                  <div>
                    <p className="font-medium text-sm line-through text-muted-foreground">{c.nome}</p>
                    <Badge variant="outline" className="text-xs">{c.frequencia}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{formatCurrency(Number(c.valor))}</span>
                    <Button size="icon" variant="ghost" onClick={() => toggleAtivo.mutate({ id: c.id, ativo: true })}><CheckCircle2 size={14} className="text-green-400" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if(confirm(`Deletar "${c.nome}"?`)) deletar.mutate({ id: c.id }) }}><Trash2 size={14} className="text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
