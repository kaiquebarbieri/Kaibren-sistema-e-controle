import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  Instagram,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  ImageIcon,
  Copy,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type ContentType = "feed_produto" | "feed_promo" | "stories_urgencia" | "reel_dica";

interface CreativeResult {
  imageUrl?: string;
  caption: string;
  hashtags: string;
  published?: boolean;
  postId?: string;
  error?: string;
}

const contentTypeConfig: Record<ContentType, { emoji: string; color: string }> = {
  feed_produto: { emoji: "🛍️", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  feed_promo: { emoji: "🔥", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  stories_urgencia: { emoji: "⚡", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  reel_dica: { emoji: "🎬", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
};

export default function StudioCriativos() {
  const [produto, setProduto] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [tipo, setTipo] = useState<ContentType>("feed_produto");
  const [publicar, setPublicar] = useState(false);
  const [result, setResult] = useState<CreativeResult | null>(null);
  const [history, setHistory] = useState<Array<CreativeResult & { produto: string; tipo: ContentType }>>([]);

  const { data: contentTypes } = trpc.studio.contentTypes.useQuery();

  const generateMutation = trpc.studio.generateCreative.useMutation({
    onSuccess: (data) => {
      setResult(data);
      if (data.imageUrl) {
        setHistory(prev => [{ ...data, produto, tipo }, ...prev.slice(0, 9)]);
      }
      if (data.published) {
        toast.success("Publicado no Instagram!", { description: `Post ID: ${data.postId}` });
      } else if (data.error) {
        toast.error("Imagem gerada com aviso", { description: data.error });
      } else {
        toast.success("Criativo gerado!", { description: "Imagem e legenda prontos." });
      }
    },
    onError: (err) => {
      toast.error("Erro ao gerar criativo", { description: err.message });
    },
  });

  const publishMutation = trpc.studio.publishPost.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Publicado no Instagram!", { description: `Post ID: ${data.postId}` });
        setResult(prev => prev ? { ...prev, published: true, postId: data.postId } : prev);
        setHistory(prev => prev.map((h, i) => i === 0 ? { ...h, published: true, postId: data.postId } : h));
      } else {
        toast.error("Erro ao publicar", { description: data.error });
      }
    },
  });

  const handleGenerate = () => {
    if (!produto.trim() || !detalhe.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setResult(null);
    generateMutation.mutate({ produto, detalhe, tipo, publicar });
  };

  const handlePublishNow = () => {
    if (!result?.imageUrl || !result?.caption) return;
    publishMutation.mutate({ imageUrl: result.imageUrl, caption: result.caption });
  };

  const copyCaption = () => {
    if (result?.caption) {
      navigator.clipboard.writeText(result.caption);
      toast.success("Legenda copiada!");
    }
  };

  const isLoading = generateMutation.isPending;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Studio de Criativos</h1>
          <p className="text-sm text-zinc-400">Geração de imagens e publicação automática — @kaibren_</p>
        </div>
        <Badge className="ml-auto border-green-500/30 bg-green-500/10 text-green-400">
          <Instagram className="w-3 h-3 mr-1" />
          @kaibren_ conectado
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Novo Criativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-zinc-400 text-sm">Produto</Label>
              <Input
                className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                placeholder="ex: Botão AF-33 3,2L Mondial"
                value={produto}
                onChange={e => setProduto(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-zinc-400 text-sm">Detalhe / Contexto</Label>
              <Textarea
                className="mt-1 bg-zinc-800 border-zinc-700 text-white resize-none"
                rows={3}
                placeholder="ex: Compatível com air fryer AF-33 e AF-34, cor vermelha, R$23,98"
                value={detalhe}
                onChange={e => setDetalhe(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-zinc-400 text-sm">Tipo de Conteúdo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as ContentType)}>
                <SelectTrigger className="mt-1 bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {contentTypes?.map(ct => (
                    <SelectItem key={ct.value} value={ct.value} className="text-white">
                      {contentTypeConfig[ct.value as ContentType]?.emoji} {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg border border-zinc-700">
              <div>
                <p className="text-sm text-white font-medium">Publicar automaticamente</p>
                <p className="text-xs text-zinc-500">Posta no @kaibren_ após gerar</p>
              </div>
              <Switch checked={publicar} onCheckedChange={setPublicar} />
            </div>

            <Button
              className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-black font-semibold"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando criativo...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar Criativo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <div className="space-y-4">
          {isLoading && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-600/20 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-yellow-400 animate-pulse" />
                </div>
                <p className="text-zinc-400 text-sm">IA gerando seu criativo...</p>
              </CardContent>
            </Card>
          )}

          {result && !isLoading && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base">Criativo Gerado</CardTitle>
                  <div className="flex items-center gap-2">
                    {result.published ? (
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Publicado
                      </Badge>
                    ) : result.error ? (
                      <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                        <XCircle className="w-3 h-3 mr-1" />
                        Erro
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Pronto
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.imageUrl && (
                  <div className="relative group">
                    <img
                      src={result.imageUrl}
                      alt="Criativo gerado"
                      className="w-full rounded-lg object-cover aspect-square"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                        onClick={() => window.open(result.imageUrl, "_blank")}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Baixar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-400 text-xs">Legenda completa</Label>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-zinc-500 hover:text-white" onClick={copyCaption}>
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </Button>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {result.caption}
                  </div>
                </div>

                {result.error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">
                    {result.error}
                  </div>
                )}

                <div className="flex gap-2">
                  {!result.published && result.imageUrl && (
                    <Button
                      className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                      onClick={handlePublishNow}
                      disabled={publishMutation.isPending}
                    >
                      {publishMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Instagram className="w-4 h-4 mr-2" />
                      )}
                      Publicar agora
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    onClick={handleGenerate}
                    disabled={isLoading}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Regerar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!result && !isLoading && (
            <Card className="bg-zinc-900 border-zinc-800 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <ImageIcon className="w-10 h-10 text-zinc-600" />
                <p className="text-zinc-500 text-sm text-center">
                  Preencha o formulário e gere<br />seu primeiro criativo
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Histórico da Sessão</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {history.map((item, i) => (
              <div
                key={i}
                className="relative group cursor-pointer rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-colors"
                onClick={() => setResult(item)}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.produto} className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-zinc-800 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-zinc-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                  <p className="text-white text-xs font-medium text-center line-clamp-2">{item.produto}</p>
                </div>
                {item.published && (
                  <div className="absolute top-1.5 right-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-400 drop-shadow" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
