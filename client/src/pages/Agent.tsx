import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ShieldCheck, Sparkles, LockKeyhole, DatabaseZap, Bot } from "lucide-react";

const INITIAL_MESSAGES: Message[] = [
  {
    role: "system",
    content: "Você é o agente interno da CK Distribuidora. Responda com foco operacional, financeiro e comercial.",
  },
];

const SUGGESTED_PROMPTS = [
  "Resuma as prioridades financeiras do período",
  "Explique como o agente poderá consultar dados internos com segurança",
  "Liste automações que posso conectar depois",
];

export default function Agent() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const statusQuery = trpc.agent.status.useQuery();
  const chatMutation = trpc.agent.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
    },
    onError: () => {
      toast.error("Não foi possível falar com o agente agora.");
    },
  });

  useEffect(() => {
    if (!statusQuery.data) return;

    setMessages((prev) => {
      const alreadyInitialized = prev.some(
        (message) => message.role === "assistant" && message.content.includes("estrutura segura do agente"),
      );

      if (alreadyInitialized) return prev;

      return [
        ...prev,
        {
          role: "assistant",
          content: statusQuery.data.message,
        },
      ];
    });
  }, [statusQuery.data]);

  const capabilityCards = useMemo(
    () => [
      {
        title: "Acesso protegido",
        description: "O agente fica dentro do login já existente do sistema, sem autenticação separada para o usuário final.",
        icon: ShieldCheck,
      },
      {
        title: "Chave isolada no servidor",
        description: "A futura integração com OpenAI será feita apenas no backend, sem expor credenciais no frontend.",
        icon: LockKeyhole,
      },
      {
        title: "Pronto para dados internos",
        description: "A estrutura foi desenhada para conectar consultas, automações e ações assistidas sobre módulos do próprio sistema.",
        icon: DatabaseZap,
      },
    ],
    [],
  );

  function handleSendMessage(content: string) {
    const nextMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    chatMutation.mutate({ messages: nextMessages });
  }

  return (
    <DashboardLayout activeSection="agente">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 p-6 text-white shadow-[0_25px_80px_rgba(15,23,42,0.35)] sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.16),transparent_30%)]" />
          <div className="relative space-y-4">
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">Agente interno</Badge>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Chat operacional seguro dentro do seu sistema</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">
                Esta área já deixa o agente preparado para operar no mesmo login do usuário autenticado, com arquitetura pensada para futuras automações, leitura de dados internos e integração segura com OpenAI no servidor.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-200 sm:text-sm">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Sem login separado</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Backend-first</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Escalável para automações</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-2 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Assistente CK</CardTitle>
                  <CardDescription>
                    Estrutura inicial conectada a uma rota protegida no backend e pronta para receber a API da OpenAI.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Provider: {statusQuery.data?.provider ?? "openai"}</Badge>
                <Badge variant="outline">Modo: {statusQuery.data?.mode ?? "backend_stub"}</Badge>
                <Badge variant="outline">Status: {statusQuery.data?.enabled ? "ativo" : "preparado"}</Badge>
              </div>
              <AIChatBox
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={chatMutation.isPending || statusQuery.isLoading}
                height={540}
                placeholder="Digite uma solicitação para o agente interno"
                emptyStateMessage="Comece uma conversa com o agente interno da CK Distribuidora"
                suggestedPrompts={SUGGESTED_PROMPTS}
              />
            </CardContent>
          </Card>

          <div className="space-y-4">
            {capabilityCards.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-border/60 shadow-sm">
                  <CardHeader className="space-y-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription className="mt-1 leading-6">{item.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}

            <Card className="border-border/60 bg-muted/30 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Próximas conexões previstas
                </CardTitle>
                <CardDescription>
                  A base do agente já foi organizada para crescer sem refazer a arquitetura principal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>O próximo passo será informar a chave da OpenAI em ambiente seguro, ligar a procedure protegida ao provedor e aplicar permissões por perfil para consultas, automações e ações assistidas.</p>
                <Separator />
                <p>Depois disso, será possível acoplar leitura de pedidos, finanças, produtos, clientes e automações assistidas com trilha de auditoria por usuário.</p>
                <Button variant="outline" className="w-full justify-start bg-background text-left">
                  Estrutura pronta para conexão segura posterior
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
