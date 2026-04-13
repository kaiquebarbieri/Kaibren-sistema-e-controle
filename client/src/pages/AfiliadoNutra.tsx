import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  ExternalLink,
  Globe,
  Rocket,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { useState } from "react";

const OFFERS = [
  {
    rank: 1,
    name: "Java Burn",
    niche: "Café + Emagrecimento",
    commission: "$150",
    epc: "$1.62",
    conv: "1.23%",
    gravity: "Alta",
    ads: ["Google", "Facebook", "Email"],
    url: "https://javaburncoffee.co/affiliates",
    id: "javaburn",
    angle: "Adicione ao café da manhã e queime gordura sem dieta",
    tag: "RECOMENDADO",
    tagColor: "bg-amber-500",
    meta800: "~4-5 vendas",
    roi800: "+R$3.400",
  },
  {
    rank: 2,
    name: "Prostadine",
    niche: "Saúde Prostata 45+",
    commission: "$130",
    epc: "$1.68",
    conv: "1.45%",
    gravity: "Muito Alta",
    ads: ["Google", "Facebook", "Native"],
    url: "https://getprostadine.com/help/affiliates.php",
    id: "prostadine",
    angle: "Resolve problema da próstata causado por água contaminada",
    tag: "TOP EPC",
    tagColor: "bg-blue-600",
    meta800: "~5-6 vendas",
    roi800: "+R$4.200",
  },
  {
    rank: 3,
    name: "Sumatra Slim Belly",
    niche: "Barriga + Sono",
    commission: "$120",
    epc: "$1.00+",
    conv: "—",
    gravity: "Alta",
    ads: ["Facebook", "Email", "YouTube"],
    url: "https://sumatraslimbelly.com/affiliates",
    id: "sumatonic",
    angle: "Tonifica o belly melhorando a qualidade do sono",
    tag: "85% COMISSÃO",
    tagColor: "bg-green-600",
    meta800: "~3-4 vendas",
    roi800: "+R$2.700",
  },
  {
    rank: 4,
    name: "All Day Slimming Tea",
    niche: "Chá Emagrecimento",
    commission: "$25",
    epc: "$1.34",
    conv: "5.81%",
    gravity: "Muito Alta",
    ads: ["Google", "Facebook", "TikTok", "YouTube"],
    url: "https://alldayslimmingteafree.com/aff/",
    id: "allslimtea",
    angle: "Modelo free + frete — funil de alta conversão",
    tag: "5.81% CONV",
    tagColor: "bg-purple-600",
    meta800: "+10 vendas",
    roi800: "+R$1.400",
  },
  {
    rank: 5,
    name: "Arya Leaf",
    niche: "Dor / Alívio Natural",
    commission: "$50",
    epc: "$1.70",
    conv: "62%",
    gravity: "Média",
    ads: ["Google", "Native"],
    url: "https://clickbank.com/marketplace",
    id: "aryaleaf",
    angle: "Micro-nicho dor articular — menos concorrência",
    tag: "62% CONV",
    tagColor: "bg-rose-600",
    meta800: "~6-8 vendas",
    roi800: "+R$2.200",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Criar conta ClickBank",
    desc: "Gratuito, aprovação instantânea",
    url: "https://accounts.clickbank.com/master/makebank.html",
    time: "5 min",
    done: false,
  },
  {
    step: "02",
    title: "Criar conta Payoneer",
    desc: "Receber comissões em dólar no CNPJ da Kaibren",
    url: "https://www.payoneer.com",
    time: "24h aprovação",
    done: false,
  },
  {
    step: "03",
    title: "Escolher a offer",
    desc: "Selecionar produto abaixo e solicitar aprovação de afiliado",
    url: null,
    time: "10 min",
    done: false,
  },
  {
    step: "04",
    title: "Luna gera criativos em inglês",
    desc: "2-3 criativos para Google Ads / Facebook",
    url: null,
    time: "Noah faz",
    done: false,
  },
  {
    step: "05",
    title: "Subir campanha Google Ads",
    desc: "$10/dia — Maya analisa diariamente",
    url: null,
    time: "Dias 2-3",
    done: false,
  },
];

export default function AfiliadoNutra() {
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);

  return (
    <DashboardLayout section="afiliado-nutra">
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Projeto Internacional
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Afiliado Nutra — EUA 🇺🇸
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tráfego pago para ofertas ClickBank · Comissões em dólar · R$800 de orçamento inicial
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs px-3 py-1">
              <Zap className="h-3 w-3 mr-1" /> Projeto Ativo
            </Badge>
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs px-3 py-1">
              <CircleDollarSign className="h-3 w-3 mr-1" /> R$800 alocados
            </Badge>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Orçamento", value: "R$800", sub: "~$140 USD", icon: Wallet, color: "text-amber-400" },
            { label: "Meta (1ª venda)", value: "7 dias", sub: "break-even", icon: Clock, color: "text-blue-400" },
            { label: "Comissão média", value: "$130", sub: "por venda", icon: TrendingUp, color: "text-emerald-400" },
            { label: "ROI potencial", value: "+150%", sub: "com 2 vendas", icon: Rocket, color: "text-purple-400" },
          ].map((kpi) => (
            <Card key={kpi.label} className="bg-card border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                  </div>
                  <kpi.icon className={`h-5 w-5 ${kpi.color} opacity-60`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Offers Table */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top 5 Offers ClickBank — Ranqueadas para R$800
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">#</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Produto</th>
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Ângulo</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Comissão</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium hidden md:table-cell">EPC</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Meta R$800</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {OFFERS.map((offer) => (
                    <tr
                      key={offer.id}
                      className={`border-b border-border/20 transition-colors cursor-pointer ${
                        selectedOffer === offer.id
                          ? "bg-primary/10"
                          : "hover:bg-muted/30"
                      }`}
                      onClick={() =>
                        setSelectedOffer(selectedOffer === offer.id ? null : offer.id)
                      }
                    >
                      <td className="p-3">
                        <span className="text-xs font-bold text-muted-foreground">
                          {offer.rank === 1 ? "🥇" : offer.rank === 2 ? "🥈" : offer.rank === 3 ? "🥉" : `0${offer.rank}`}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{offer.name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${offer.tagColor}`}>
                              {offer.tag}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{offer.niche}</span>
                        </div>
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground italic">{offer.angle}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-semibold text-emerald-400">{offer.commission}</span>
                      </td>
                      <td className="p-3 text-right hidden md:table-cell">
                        <span className="text-muted-foreground">{offer.epc}</span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-medium text-foreground">{offer.meta800}</span>
                          <span className="text-xs text-emerald-400 font-semibold">{offer.roi800}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant={selectedOffer === offer.id ? "default" : "outline"}
                          className="text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOffer(offer.id);
                          }}
                        >
                          {selectedOffer === offer.id ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1" /> Escolhido</>
                          ) : (
                            "Escolher"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected Offer Detail */}
            {selectedOffer && (() => {
              const offer = OFFERS.find((o) => o.id === selectedOffer);
              if (!offer) return null;
              return (
                <div className="border-t border-border/30 p-4 bg-primary/5">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        ✅ {offer.name} selecionado
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">{offer.angle}</p>
                      <div className="flex flex-wrap gap-1">
                        {offer.ads.map((ad) => (
                          <span key={ad} className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">
                            {ad}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs h-8" asChild>
                        <a href={offer.url} target="_blank" rel="noopener noreferrer">
                          Ver Afiliados <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Setup Checklist */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              Checklist de Setup — Do zero à primeira venda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {STEPS.map((step) => (
                <div
                  key={step.step}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/30 hover:border-border/60 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{step.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        {step.time}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                  {step.url && (
                    <Button size="sm" variant="ghost" className="text-xs h-7 flex-shrink-0" asChild>
                      <a href={step.url} target="_blank" rel="noopener noreferrer">
                        Abrir <ArrowUpRight className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Budget Calculator */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-primary" />
              Simulação de Retorno — R$800
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  scenario: "Conservador",
                  sales: 1,
                  commission: 130,
                  spend: 140,
                  color: "border-amber-500/30 bg-amber-500/5",
                  badge: "bg-amber-500/20 text-amber-400",
                },
                {
                  scenario: "Realista",
                  sales: 3,
                  commission: 130,
                  spend: 140,
                  color: "border-blue-500/30 bg-blue-500/5",
                  badge: "bg-blue-500/20 text-blue-400",
                },
                {
                  scenario: "Otimista",
                  sales: 6,
                  commission: 130,
                  spend: 140,
                  color: "border-emerald-500/30 bg-emerald-500/5",
                  badge: "bg-emerald-500/20 text-emerald-400",
                },
              ].map((s) => {
                const revenue = s.sales * s.commission * 5.7;
                const spend = s.spend * 5.7;
                const profit = revenue - spend;
                const roi = Math.round((profit / spend) * 100);
                return (
                  <div key={s.scenario} className={`rounded-lg border p-4 ${s.color}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-foreground">{s.scenario}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${s.badge}`}>
                        {s.sales} venda{s.sales > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gasto</span>
                        <span className="text-foreground">R${spend.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Receita</span>
                        <span className="text-emerald-400">R${revenue.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between border-t border-border/30 pt-1 mt-1">
                        <span className="text-muted-foreground font-medium">Lucro</span>
                        <span className={`font-bold ${profit > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          R${profit.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ROI</span>
                        <span className={`font-bold ${roi > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {roi > 0 ? "+" : ""}{roi}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
