import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const KAIBREN_GOLD = "#D4AF37";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Message = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

type ActionStatus = "idle" | "running" | "done" | "error";

type Props = {
  /** Tela atual em linguagem natural — ex.: "Contas a Pagar" */
  screenContext: string;
  /** Resumo dos dados da tela em texto curto pra Lia ler — ex.: "5 contas, 1 vencida R$ 12.500…" */
  pageData?: string;
  /** Sugestões clicáveis específicas da tela */
  quickPrompts?: string[];
  /** Empresa selecionada na tela — usada como cnpjId default em ações */
  cnpjId?: number;
};

const LIA_GREETINGS = [
  "Oi Brenda! Estou aqui pra te ajudar nessa tela. Pode pedir.",
  "Pronta pra te ajudar. Quer revisar pendências, cadastrar algo ou tirar dúvida?",
  "Oi! Pode me mandar print de boleto que eu cadastro pra você.",
];

export default function LiaChat({ screenContext, pageData, quickPrompts, cnpjId }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const sendMutation = trpc.lia.send.useMutation();
  const createPayable = trpc.finance.payables.create.useMutation();
  const registerPayment = trpc.finance.payables.registerPayment.useMutation();
  const createCustoFixo = trpc.createCustoFixo.useMutation();

  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = LIA_GREETINGS[Math.floor(Math.random() * LIA_GREETINGS.length)];
      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const accepted: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} tem mais de 5MB — manda uma versão menor.`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      accepted.push(dataUrl);
    }
    if (accepted.length > 0) setPendingImages((prev) => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    const hasImages = pendingImages.length > 0;
    if ((!trimmed && !hasImages) || thinking) return;
    const userMsg: Message = {
      role: "user",
      content: trimmed || (hasImages ? "(imagem enviada)" : ""),
      images: hasImages ? pendingImages : undefined,
    };
    const next: Message[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setThinking(true);
    const imagesToSend = pendingImages;
    setPendingImages([]);
    try {
      const result = await sendMutation.mutateAsync({
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        screenContext,
        pageData,
        cnpjId,
        images: imagesToSend.length > 0 ? imagesToSend : undefined,
      });
      setMessages([...next, { role: "assistant", content: result.reply }]);
    } catch (err: any) {
      setMessages([
        ...next,
        { role: "assistant", content: "Tive um problema. Tenta de novo em instantes — se continuar, avisa o Kaique." },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function executeAction(actionKey: string, action: any) {
    if (!action || typeof action !== "object" || !action.action) return;
    setActionStatus((prev) => ({ ...prev, [actionKey]: "running" }));
    try {
      switch (action.action) {
        case "create_payable": {
          const d = action.data ?? {};
          if (!d.title || !d.amount || !d.dueDate) {
            throw new Error("Faltam dados (título, valor ou vencimento).");
          }
          await createPayable.mutateAsync({
            title: String(d.title),
            cnpjId: d.cnpjId ?? cnpjId ?? null,
            supplier: d.supplier ?? null,
            category: d.category ?? "outros",
            accountType: d.accountType ?? "boleto",
            amount: String(d.amount),
            dueDate: String(d.dueDate),
            paymentMethod: d.paymentMethod ?? null,
            description: d.description ?? null,
            notes: d.notes ?? null,
          } as any);
          toast.success("Conta cadastrada!");
          await utils.finance.payables.list.invalidate();
          await utils.finance.payables.dashboard.invalidate();
          break;
        }
        case "create_fixed_cost": {
          const d = action.data ?? {};
          if (!d.nome || d.valor == null) {
            throw new Error("Faltam dados (nome ou valor).");
          }
          await createCustoFixo.mutateAsync({
            nome: String(d.nome),
            valor: Number(d.valor),
            frequencia: d.frequencia ?? "mensal",
            categoria: d.categoria ?? null,
            observacao: d.observacao ?? null,
          });
          toast.success("Custo fixo cadastrado!");
          await utils.listCustosFixos.invalidate();
          break;
        }
        case "mark_payable_paid": {
          const d = action.data ?? {};
          if (!d.id || !d.paidAmount || !d.paidAt) {
            throw new Error("Faltam dados (id, valor pago ou data).");
          }
          await registerPayment.mutateAsync({
            id: Number(d.id),
            paidAmount: String(d.paidAmount),
            paidAt: new Date(d.paidAt),
            paymentMethod: d.paymentMethod ?? null,
            notes: d.notes ?? null,
          });
          toast.success("Pagamento registrado!");
          await utils.finance.payables.list.invalidate();
          await utils.finance.payables.dashboard.invalidate();
          break;
        }
        default:
          throw new Error(`Ação "${action.action}" ainda não é executada automaticamente.`);
      }
      setActionStatus((prev) => ({ ...prev, [actionKey]: "done" }));
    } catch (err: any) {
      console.error("[lia action]", err);
      toast.error(err?.message ?? "Não consegui cadastrar.");
      setActionStatus((prev) => ({ ...prev, [actionKey]: "error" }));
    }
  }

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-[0_12px_40px_-8px_rgba(212,175,55,0.6)] transition-transform hover:scale-110"
          style={{ backgroundColor: KAIBREN_GOLD }}
          aria-label="Abrir conversa com a Lia"
          title="Falar com a Lia"
        >
          <span aria-hidden>💼</span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
        </button>
      ) : null}

      {open ? (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] max-h-[calc(100vh-3rem)] w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
          <div
            className="flex items-center gap-3 border-b border-border/40 px-4 py-3"
            style={{ background: `linear-gradient(135deg, ${KAIBREN_GOLD}26 0%, transparent 100%)` }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: KAIBREN_GOLD }}
            >
              💼
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Lia</p>
              <p className="truncate text-[11px] text-muted-foreground">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Assistente financeira · {screenContext}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                content={m.content}
                images={m.images}
                onExecute={(actionKey, action) => executeAction(`${i}:${actionKey}`, action)}
                actionStatus={actionStatus}
                bubbleId={i}
              />
            ))}
            {thinking ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" style={{ color: KAIBREN_GOLD }} />
                <span>Lia está pensando…</span>
              </div>
            ) : null}
          </div>

          {quickPrompts && quickPrompts.length > 0 && messages.length <= 1 ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border/40 px-4 py-2">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p)}
                  className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-[11px] text-[#D4AF37] transition-colors hover:bg-[#D4AF37]/20"
                  disabled={thinking}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : null}

          {pendingImages.length > 0 ? (
            <div className="flex gap-2 border-t border-border/40 bg-card/50 px-3 py-2">
              {pendingImages.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="h-14 w-14 rounded-md object-cover ring-1 ring-border/60" />
                  <button
                    onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"
                    aria-label="Remover imagem"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-t border-border/40 bg-card/50 px-3 py-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilePick}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={thinking}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              title="Anexar imagem (boleto, comprovante)"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder={pendingImages.length > 0 ? "Adicione um detalhe (opcional)…" : "Pergunte ou peça pra cadastrar…"}
              disabled={thinking}
              className="border-border/50 bg-card text-sm"
            />
            <Button
              size="icon"
              onClick={() => handleSend(input)}
              disabled={thinking || (!input.trim() && pendingImages.length === 0)}
              className="h-9 w-9 shrink-0 border-0 text-black hover:opacity-90"
              style={{ backgroundColor: KAIBREN_GOLD }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MessageBubble({
  role,
  content,
  images,
  onExecute,
  actionStatus,
  bubbleId,
}: {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  onExecute: (actionKey: string, action: any) => void;
  actionStatus: Record<string, ActionStatus>;
  bubbleId: number;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] space-y-1.5 rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-[#D4AF37]/15 text-foreground"
            : "border border-border/40 bg-muted/30 text-foreground"
        }`}
      >
        {images && images.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {images.map((src, i) => (
              <img key={i} src={src} alt="" className="h-20 w-20 rounded-md object-cover ring-1 ring-border/40" />
            ))}
          </div>
        ) : null}
        {isUser ? (
          content ? <p className="whitespace-pre-wrap">{content}</p> : null
        ) : (
          <FormattedMessage
            content={content}
            onExecute={onExecute}
            actionStatus={actionStatus}
            bubbleId={bubbleId}
          />
        )}
      </div>
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  create_payable: "Cadastrar conta a pagar",
  create_fixed_cost: "Cadastrar custo fixo",
  mark_payable_paid: "Marcar como pago",
  categorize_transaction: "Categorizar transação",
};

function FormattedMessage({
  content,
  onExecute,
  actionStatus,
  bubbleId,
}: {
  content: string;
  onExecute: (actionKey: string, action: any) => void;
  actionStatus: Record<string, ActionStatus>;
  bubbleId: number;
}) {
  const parts = content.split(/(```json[\s\S]*?```|```[\s\S]*?```|\*\*[^*]+\*\*)/g);
  let jsonIdx = 0;
  return (
    <div className="space-y-1.5">
      {parts.map((part, i) => {
        if (part.startsWith("```json")) {
          const json = part.replace(/^```json\n?/, "").replace(/```$/, "").trim();
          let parsed: any = null;
          try {
            parsed = JSON.parse(json);
          } catch {
            return (
              <pre key={i} className="overflow-x-auto rounded-lg bg-card/60 p-2 text-[11px] font-mono text-foreground/80">
                {json}
              </pre>
            );
          }
          const actionType = parsed?.action;
          const label = ACTION_LABEL[actionType] ?? "Ação sugerida";
          const localKey = String(jsonIdx++);
          const statusKey = `${bubbleId}:${localKey}`;
          const status: ActionStatus = actionStatus[statusKey] ?? "idle";
          const supported = actionType === "create_payable" || actionType === "create_fixed_cost" || actionType === "mark_payable_paid";
          return (
            <div key={i} className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-2 text-[11px]">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                <Sparkles className="h-3 w-3" />
                {label}
              </div>
              <ActionPreview data={parsed?.data ?? {}} action={actionType} />
              {supported ? (
                status === "done" ? (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-500">
                    <Check className="h-3 w-3" /> Cadastrado com sucesso
                  </div>
                ) : (
                  <button
                    onClick={() => onExecute(localKey, parsed)}
                    disabled={status === "running"}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-[#D4AF37] px-3 py-1.5 text-[11px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {status === "running" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Cadastrando…
                      </>
                    ) : status === "error" ? (
                      "Tentar de novo"
                    ) : (
                      "Cadastrar agora"
                    )}
                  </button>
                )
              ) : (
                <p className="mt-1.5 text-[10px] italic text-muted-foreground">
                  (Esse tipo de ação ainda precisa ser feito manualmente na tela.)
                </p>
              )}
            </div>
          );
        }
        if (part.startsWith("```")) {
          return (
            <pre key={i} className="overflow-x-auto rounded-lg bg-card/60 p-2 text-[11px] font-mono text-foreground/80">
              {part.replace(/^```\w*\n?/, "").replace(/```$/, "")}
            </pre>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return <span key={i} className="whitespace-pre-wrap">{part}</span>;
      })}
    </div>
  );
}

function ActionPreview({ data, action }: { data: Record<string, any>; action?: string }) {
  const rows: Array<[string, string]> = [];
  const fmt = (v: any) => {
    if (v == null) return "—";
    if (typeof v === "number") return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    return String(v);
  };
  if (action === "create_payable") {
    if (data.title) rows.push(["Título", data.title]);
    if (data.supplier) rows.push(["Fornecedor", data.supplier]);
    if (data.amount != null) rows.push(["Valor", `R$ ${fmt(Number(data.amount))}`]);
    if (data.dueDate) rows.push(["Vencimento", String(data.dueDate)]);
    if (data.category) rows.push(["Categoria", data.category]);
    if (data.accountType) rows.push(["Tipo", data.accountType]);
    if (data.paymentMethod) rows.push(["Pagamento", data.paymentMethod]);
  } else if (action === "create_fixed_cost") {
    if (data.nome) rows.push(["Nome", data.nome]);
    if (data.valor != null) rows.push(["Valor", `R$ ${fmt(Number(data.valor))}`]);
    if (data.frequencia) rows.push(["Frequência", data.frequencia]);
    if (data.categoria) rows.push(["Categoria", data.categoria]);
    if (data.observacao) rows.push(["Obs.", data.observacao]);
  } else if (action === "mark_payable_paid") {
    if (data.id) rows.push(["Conta #", String(data.id)]);
    if (data.paidAmount) rows.push(["Valor pago", `R$ ${fmt(Number(data.paidAmount))}`]);
    if (data.paidAt) rows.push(["Pago em", String(data.paidAt)]);
    if (data.paymentMethod) rows.push(["Forma", data.paymentMethod]);
  } else {
    for (const [k, v] of Object.entries(data ?? {})) rows.push([k, fmt(v)]);
  }
  if (rows.length === 0) {
    return <p className="text-[10px] italic text-muted-foreground">Sem dados</p>;
  }
  return (
    <div className="space-y-0.5 text-[11px]">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-baseline gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">{k}:</span>
          <span className="font-medium text-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}

