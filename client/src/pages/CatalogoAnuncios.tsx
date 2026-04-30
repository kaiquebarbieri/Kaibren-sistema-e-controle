import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

type StatusFilter = "all" | "pending" | "complete" | "incomplete" | "failed";

interface StructuredData {
  marca?: string | null;
  tipo_aparelho?: string | null;
  tipo_peca?: string | null;
  modelos_compativeis?: string[];
  capacidades?: string[];
  voltagens?: string[];
  alertas?: string[];
  extraction_status?: string;
  missing_info?: string[];
}

function StatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Completo
      </Badge>
    );
  }
  if (status === "incomplete") {
    return (
      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
        <AlertTriangle className="w-3 h-3 mr-1" /> Incompleto
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20">
        <XCircle className="w-3 h-3 mr-1" /> Falhou
      </Badge>
    );
  }
  return (
    <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/30 hover:bg-slate-500/20">
      <Clock className="w-3 h-3 mr-1" /> Pendente
    </Badge>
  );
}

export default function CatalogoAnuncios() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editJson, setEditJson] = useState<string>("");

  const list = trpc.shopeeChat.catalog.list.useQuery({ status, search });
  const detail = trpc.shopeeChat.catalog.detail.useQuery(
    { id: selectedId || 0 },
    { enabled: !!selectedId },
  );

  const utils = trpc.useUtils();
  const updateMut = trpc.shopeeChat.catalog.updateStructured.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados");
      utils.shopeeChat.catalog.list.invalidate();
      utils.shopeeChat.catalog.detail.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const reextractMut = trpc.shopeeChat.catalog.reextract.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Re-extração: ${r.complete} completos, ${r.incomplete} incompletos, ${r.failed} falhas, ${r.skipped} pulados`,
      );
      utils.shopeeChat.catalog.list.invalidate();
      utils.shopeeChat.catalog.detail.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const items = list.data || [];
  const stats = useMemo(() => {
    const s = { total: items.length, complete: 0, incomplete: 0, failed: 0, pending: 0 };
    for (const it of items) {
      const k = (it.extractionStatus || "pending") as keyof typeof s;
      if (k in s) (s as any)[k]++;
    }
    return s;
  }, [items]);

  const openDetail = (id: number) => {
    setSelectedId(id);
    setEditJson("");
  };

  const closeDetail = () => {
    setSelectedId(null);
    setEditJson("");
  };

  const handleSave = () => {
    if (!selectedId || !editJson) return;
    updateMut.mutate({ id: selectedId, structuredData: editJson });
  };

  const detailData = detail.data;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Catálogo de Anúncios — Sam</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conhecimento estruturado extraído dos anúncios Shopee. O Sam usa essa base pra responder com precisão sobre compatibilidade.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => reextractMut.mutate({})}
            disabled={reextractMut.isPending}
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${reextractMut.isPending ? "animate-spin" : ""}`} />
            Re-extrair pendentes
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-semibold text-foreground">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-emerald-400">Completos</div>
              <div className="text-2xl font-semibold text-foreground">{stats.complete}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-amber-400">Incompletos</div>
              <div className="text-2xl font-semibold text-foreground">{stats.incomplete}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-slate-400">Pendentes</div>
              <div className="text-2xl font-semibold text-foreground">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-xs text-red-400">Falhas</div>
              <div className="text-2xl font-semibold text-foreground">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="incomplete">Incompletos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="failed">Falhas</SelectItem>
                  <SelectItem value="complete">Completos</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, modelo, marca..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Anúncio</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Peça</TableHead>
                  <TableHead>Modelos</TableHead>
                  <TableHead>Alertas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {list.isLoading ? "Carregando..." : "Nenhum anúncio encontrado"}
                    </TableCell>
                  </TableRow>
                )}
                {items.map((item) => {
                  const s: StructuredData | null = item.structured;
                  const modelos = s?.modelos_compativeis || [];
                  const alertas = s?.alertas || [];
                  return (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(item.id)}
                    >
                      <TableCell className="font-medium max-w-[300px] truncate">{item.title}</TableCell>
                      <TableCell className="text-muted-foreground">{s?.marca || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{s?.tipo_peca || "—"}</TableCell>
                      <TableCell>
                        {modelos.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {modelos.slice(0, 3).map((m) => (
                              <Badge key={m} variant="outline" className="text-xs">
                                {m}
                              </Badge>
                            ))}
                            {modelos.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{modelos.length - 3}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {alertas.length > 0 ? (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                            <AlertTriangle className="w-3 h-3 mr-1" /> {alertas.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.extractionStatus || "pending"} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">{detailData?.title || "Carregando..."}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Item ID: {detailData?.scope?.replace("shopee:", "") || "—"} · Status:{" "}
              {detailData && <StatusBadge status={detailData.extractionStatus || "pending"} />}
            </DialogDescription>
          </DialogHeader>

          {detailData && (
            <div className="space-y-4">
              {detailData.structured && (
                <div className="rounded-lg border border-border p-4 bg-background/50 space-y-2">
                  <div className="text-sm font-semibold text-amber-400 mb-2">Dados estruturados</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Marca:</span>{" "}
                      <span className="text-foreground">{detailData.structured.marca || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Aparelho:</span>{" "}
                      <span className="text-foreground">{detailData.structured.tipo_aparelho || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Peça:</span>{" "}
                      <span className="text-foreground">{detailData.structured.tipo_peca || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Capacidades:</span>{" "}
                      <span className="text-foreground">
                        {(detailData.structured.capacidades || []).join(", ") || "—"}
                      </span>
                    </div>
                  </div>
                  {(detailData.structured.modelos_compativeis || []).length > 0 && (
                    <div>
                      <span className="text-muted-foreground text-sm">Modelos compatíveis:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(detailData.structured.modelos_compativeis || []).map((m: string) => (
                          <Badge key={m} variant="outline" className="text-xs">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(detailData.structured.alertas || []).length > 0 && (
                    <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 mt-2">
                      <div className="text-sm font-semibold text-amber-400 mb-1 flex items-center">
                        <AlertTriangle className="w-4 h-4 mr-2" /> Alertas de compatibilidade
                      </div>
                      <ul className="text-sm text-foreground space-y-1 list-disc list-inside">
                        {(detailData.structured.alertas || []).map((a: string, i: number) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(detailData.structured.missing_info || []).length > 0 && (
                    <div className="text-xs text-muted-foreground italic">
                      Faltando: {(detailData.structured.missing_info || []).join(", ")}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label className="text-foreground mb-2 block">JSON estruturado (editar manualmente)</Label>
                <Textarea
                  rows={12}
                  className="font-mono text-xs"
                  placeholder="JSON aparece aqui após carregar..."
                  value={
                    editJson ||
                    (detailData.structured ? JSON.stringify(detailData.structured, null, 2) : "")
                  }
                  onChange={(e) => setEditJson(e.target.value)}
                />
              </div>

              <details className="rounded-lg border border-border">
                <summary className="p-3 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Ver descrição original do anúncio
                </summary>
                <div className="p-3 pt-0 text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto">
                  {(detailData as any).body || "—"}
                </div>
              </details>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => selectedId && reextractMut.mutate({ id: selectedId })}
              disabled={reextractMut.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${reextractMut.isPending ? "animate-spin" : ""}`} />
              Re-extrair com IA
            </Button>
            <Button onClick={handleSave} disabled={!editJson || updateMut.isPending}>
              Salvar edição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
