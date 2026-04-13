import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  ClipboardList,
  Edit3,
  Loader2,
  Plus,
  Shield,
  Trash2,
  Eye,
} from "lucide-react";
import { useState } from "react";

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  create: { label: "Criou", color: "text-emerald-400 bg-emerald-500/10", icon: Plus },
  update: { label: "Alterou", color: "text-blue-400 bg-blue-500/10", icon: Edit3 },
  delete: { label: "Excluiu", color: "text-red-400 bg-red-500/10", icon: Trash2 },
  approve: { label: "Aprovou", color: "text-emerald-400 bg-emerald-500/10", icon: ClipboardList },
  reject: { label: "Rejeitou", color: "text-red-400 bg-red-500/10", icon: Trash2 },
  login: { label: "Login", color: "text-primary bg-primary/10", icon: Eye },
  count: { label: "Contagem", color: "text-blue-400 bg-blue-500/10", icon: ClipboardList },
};

const ENTITY_LABELS: Record<string, string> = {
  product: "Produto",
  order: "Pedido",
  customer: "Cliente",
  inventory: "Estoque",
  integration: "Integração",
  team: "Equipe",
  user: "Usuário",
  alias: "Alias SKU",
  count: "Contagem",
};

export default function Auditoria() {
  const [entityFilter, setEntityFilter] = useState<string>("");
  const logQuery = trpc.audit.log.useQuery({ limit: 100, entity: entityFilter || undefined }, { refetchInterval: 30000 });
  const logs = logQuery.data || [];

  const entities = [...new Set(logs.map((l: any) => l.entity))].sort();

  return (
    <DashboardLayout activeSection="auditoria">
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Auditoria
          </h1>
          <p className="text-sm text-muted-foreground">Quem fez o quê, quando</p>
        </div>

        {/* Filtro */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setEntityFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !entityFilter ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground bg-zinc-900/60"
            }`}
          >
            Todos
          </button>
          {entities.map(e => (
            <button
              key={e}
              onClick={() => setEntityFilter(e)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                entityFilter === e ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground bg-zinc-900/60"
              }`}
            >
              {ENTITY_LABELS[e] || e}
            </button>
          ))}
        </div>

        {/* Log */}
        {logQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum registro de auditoria ainda. As ações serão registradas automaticamente.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map((log: any) => {
              const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
              const Icon = cfg.icon;
              return (
                <div key={log.id} className="flex items-start gap-3 bg-zinc-900/40 rounded-lg p-3 border border-border/20">
                  <div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{log.userName || "Sistema"}</span>
                      <Badge className={`${cfg.color} text-[10px] border-0`}>{cfg.label}</Badge>
                      <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px]">
                        {ENTITY_LABELS[log.entity] || log.entity}
                      </Badge>
                      {log.entityId && (
                        <span className="text-[10px] font-mono text-muted-foreground">{log.entityId}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>
                    {(log.previousValue || log.newValue) && (
                      <div className="mt-1 text-[10px] space-y-0.5">
                        {log.previousValue && (
                          <div className="text-red-400/70">- {log.previousValue.slice(0, 150)}</div>
                        )}
                        {log.newValue && (
                          <div className="text-emerald-400/70">+ {log.newValue.slice(0, 150)}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
