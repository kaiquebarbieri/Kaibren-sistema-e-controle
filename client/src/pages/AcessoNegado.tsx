import DashboardLayout from "@/components/DashboardLayout";
import { AlertTriangle, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AcessoNegado() {
  return (
    <DashboardLayout activeSection="dashboard">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <Card className="w-full border-amber-500/20 bg-amber-500/5">
          <CardHeader>
            <div className="mb-3 flex items-center gap-3 text-amber-400">
              <ShieldX className="h-6 w-6" />
              <CardTitle>Acesso restrito</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground">
              Esta área é gerencial e não está liberada para o seu perfil.
            </p>
            <div className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/40 p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Se precisar executar alguma tarefa nesta área, peça liberação ao Kaique ou à Brenda.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
