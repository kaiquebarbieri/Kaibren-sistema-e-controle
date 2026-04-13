import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/hooks/useTheme";
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  Globe,
  Instagram,
  Landmark,
  Layers,
  Sparkles,
  LogOut,
  Megaphone,
  Menu,
  Mic,
  Moon,
  Sun,
  MessageSquare,
  Package,
  PanelLeft,
  ReceiptText,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Target,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type AppRole = "admin" | "user";

type MenuItem = {
  icon: any;
  label: string;
  section: string;
  href: string;
  indent?: boolean;
  parentSection?: string;
  badge?: "dot-green";
  roles?: AppRole[];
  hiddenFromMenu?: boolean;
};

const menuItems: MenuItem[] = [
  { icon: BarChart3, label: "Dashboard", section: "dashboard", href: "/", roles: ["admin", "user"] },
  { icon: Mic, label: "Noah Voice", section: "noah-voice", href: "/noah", roles: ["admin"] },
  { icon: Layers, label: "Meu Dia", section: "operacional", href: "/operacional", roles: ["user"] },
  { icon: ShoppingCart, label: "Vendas", section: "pedidos", href: "/pedidos", roles: ["admin", "user"] },
  { icon: ShoppingBag, label: "Shopee Ads", section: "shopee", href: "/shopee", roles: ["admin"] },
  { icon: Package, label: "Produtos", section: "produtos", href: "/produtos", roles: ["admin", "user"] },
  { icon: Package, label: "Catálogo ML", section: "catalogo-ml", href: "/catalogo-ml", indent: true, parentSection: "produtos", roles: ["admin"] },
  { icon: ShoppingBag, label: "Lista Compras Mondial", section: "lista-compras", href: "/lista-compras", indent: true, parentSection: "produtos", roles: ["admin"] },
  { icon: Wallet, label: "Financeiro", section: "financeiro", href: "/financeiro", roles: ["admin"] },
  { icon: Wallet, label: "Custos Fixos", section: "custos-fixos", href: "/financeiro/custos-fixos", indent: true, parentSection: "financeiro", roles: ["admin"] },
  { icon: FileText, label: "Extratos", section: "extratos", href: "/extratos", indent: true, parentSection: "financeiro", roles: ["admin"] },
  { icon: ReceiptText, label: "Obrigações", section: "contas", href: "/contas/contas-a-pagar", indent: true, parentSection: "financeiro", roles: ["admin"] },
  { icon: ReceiptText, label: "Contas a Pagar", section: "contas-a-pagar", href: "/contas/contas-a-pagar", indent: true, parentSection: "contas", roles: ["admin"] },
  { icon: CreditCard, label: "Cartão de Crédito", section: "cartao-de-credito", href: "/contas/cartao-de-credito", indent: true, parentSection: "contas", roles: ["admin"] },
  { icon: Landmark, label: "Empréstimos", section: "emprestimos", href: "/contas/emprestimos", indent: true, parentSection: "contas", roles: ["admin"] },
  { icon: Megaphone, label: "Marketing", section: "marketing", href: "/marketing", roles: ["admin"], hiddenFromMenu: true },
  { icon: Sparkles, label: "Studio de Criativos", section: "studio", href: "/studio", indent: true, parentSection: "marketing", roles: ["admin"], hiddenFromMenu: true },
  { icon: Target, label: "Facebook Ads", section: "facebook-ads", href: "/marketing/facebook-ads", roles: ["admin"], hiddenFromMenu: true },
  { icon: Instagram, label: "Instagram", section: "instagram", href: "/marketing/instagram", roles: ["admin"], hiddenFromMenu: true },
  { icon: MessageSquare, label: "Mensagens ML", section: "mensagens", href: "/mensagens", roles: ["admin", "user"] },
  { icon: Warehouse, label: "Estoque", section: "estoque", href: "/estoque", roles: ["admin"] },
  { icon: Users, label: "Equipe", section: "equipe", href: "/equipe", roles: ["admin"] },
  { icon: BarChart3, label: "Relatório Executivo", section: "relatorios-exec", href: "/relatorios-exec", roles: ["admin"] },
  { icon: Shield, label: "Auditoria", section: "auditoria", href: "/auditoria", roles: ["admin"] },
  { icon: FileText, label: "Relatórios", section: "relatorios", href: "/relatorios", roles: ["admin"], hiddenFromMenu: true },
  { icon: Layers, label: "Catálogo CK Atacados", section: "catalogo-atacado", href: "/catalogo-atacado", roles: ["admin"], hiddenFromMenu: true },
  { icon: Globe, label: "Afiliado Nutra 🇺🇸", section: "afiliado-nutra", href: "/afiliado-nutra", roles: ["admin"], hiddenFromMenu: true },
  { icon: Bot, label: "Agentes", section: "agentes", href: "/agentes", roles: ["admin"], hiddenFromMenu: true },
  { icon: Bot, label: "🦾 Noah — CEO", section: "agente-noah", href: "/agentes/noah", indent: true, parentSection: "agentes", badge: "dot-green", roles: ["admin"], hiddenFromMenu: true },
  { icon: Bot, label: "💰 Léo — Financeiro", section: "agente-leo", href: "/agentes/leo", indent: true, parentSection: "agentes", roles: ["admin"], hiddenFromMenu: true },
  { icon: Bot, label: "📊 Maya — Ads", section: "agente-maya", href: "/agentes/maya", indent: true, parentSection: "agentes", roles: ["admin"], hiddenFromMenu: true },
  { icon: Bot, label: "📦 Bia — Estoque", section: "agente-bia", href: "/agentes/bia", indent: true, parentSection: "agentes", roles: ["admin"], hiddenFromMenu: true },
  { icon: Bot, label: "⚖️ Rex — Fiscal", section: "agente-rex", href: "/agentes/rex", indent: true, parentSection: "agentes", roles: ["admin"], hiddenFromMenu: true },
  { icon: Bot, label: "🛒 Sam — Vendas", section: "agente-sam", href: "/agentes/sam", indent: true, parentSection: "agentes", roles: ["admin"], hiddenFromMenu: true },
  { icon: Bot, label: "🧑‍⚖️ Bruno — Jurídico", section: "agente-bruno", href: "/agentes/bruno", indent: true, parentSection: "agentes", roles: ["admin"], hiddenFromMenu: true },
  { icon: Settings, label: "Configurações", section: "configuracoes", href: "/configuracoes", roles: ["admin"] },
  { icon: ShoppingCart, label: "Marketplaces", section: "config-marketplaces", href: "/configuracoes?tab=Marketplaces", indent: true, parentSection: "configuracoes", roles: ["admin"] },
  { icon: Target, label: "Marketing", section: "config-marketing", href: "/configuracoes?tab=Marketing", indent: true, parentSection: "configuracoes", roles: ["admin"] },
  { icon: Megaphone, label: "Comunicação", section: "config-comunicacao", href: "/configuracoes?tab=Comunicacao", indent: true, parentSection: "configuracoes", roles: ["admin"] },
  { icon: Settings, label: "Sistema", section: "config-sistema", href: "/configuracoes?tab=Sistema", indent: true, parentSection: "configuracoes", roles: ["admin"] },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

type DashboardLayoutProps = {
  children: React.ReactNode;
  onNavigate?: (section: string) => void;
  activeSection?: string;
};

type SupportContent = {
  title: string;
  description: string;
  focus: string[];
  prompts: string[];
  warning?: string;
};

const supportContentBySection: Record<string, SupportContent> = {
  dashboard: {
    title: "Visão geral do negócio",
    description: "Use esta tela para entender o que precisa de atenção primeiro e onde existe risco operacional.",
    focus: ["Ver indicadores do dia", "Identificar gargalos", "Definir prioridade da operação"],
    prompts: ["Me explica os números principais desta tela", "Qual é a prioridade operacional de hoje?", "Onde está o maior risco agora?"],
  },
  pedidos: {
    title: "Suporte para pedidos",
    description: "Aqui a IA ajuda a interpretar status, organizar atendimento e reduzir atraso ou erro no fluxo.",
    focus: ["Conferir pedidos pendentes", "Identificar atraso", "Orientar atendimento e baixa"],
    prompts: ["Qual pedido exige prioridade agora?", "Me explica os status desta tela", "Qual erro mais comum eu devo evitar aqui?"],
  },
  produtos: {
    title: "Suporte para produtos",
    description: "Use este apoio para cadastro, organização, conferência e decisões operacionais de produto.",
    focus: ["Conferir produto certo", "Evitar erro de anúncio", "Ajudar em estoque e organização"],
    prompts: ["O que eu devo conferir antes de salvar um produto?", "Como evitar erro operacional nesta área?", "Quais dados estão faltando aqui?"],
  },
  "catalogo-ml": {
    title: "Suporte para Catálogo ML",
    description: "Esta área serve para consultar e ajustar informações operacionais do catálogo puxado automaticamente do Mercado Livre.",
    focus: ["Consultar produtos por conta", "Ajustar custos quando liberado", "Evitar cadastro manual indevido"],
    prompts: ["Como usar esta tela corretamente?", "O que pode e o que não pode ser alterado aqui?", "Como encontrar um produto mais rápido?"],
    warning: "Os produtos do ML vêm da API. Esta área não é para cadastro manual.",
  },
  financeiro: {
    title: "Suporte para financeiro",
    description: "A IA ajuda a ler números, identificar risco e orientar decisões sem perder controle do caixa.",
    focus: ["Entender despesas", "Acompanhar caixa", "Ler indicadores com clareza"],
    prompts: ["Me resume esta tela em linguagem simples", "Qual número merece atenção agora?", "Onde posso estar perdendo dinheiro?"],
  },
  equipe: {
    title: "Suporte para equipe",
    description: "Aqui a IA pode ajudar a acompanhar responsabilidades, cobranças e organização do time.",
    focus: ["Distribuir tarefas", "Cobrar pendências", "Dar clareza operacional"],
    prompts: ["Como organizar melhor a equipe?", "O que cobrar primeiro hoje?", "Como estruturar acompanhamento operacional?"],
  },
  relatorios: {
    title: "Suporte para relatórios",
    description: "Use para entender rapidamente o que os dados estão mostrando e o que deve virar ação.",
    focus: ["Interpretar dados", "Extrair decisão", "Transformar relatório em ação"],
    prompts: ["Me resume este relatório", "Quais decisões saem daqui?", "O que está fora do padrão?"],
  },
  configuracoes: {
    title: "Suporte para configurações",
    description: "A IA ajuda a evitar ajuste errado em integrações, parâmetros e preferências do sistema.",
    focus: ["Revisar configuração", "Evitar erro sensível", "Entender impacto de mudança"],
    prompts: ["O que esta configuração muda no sistema?", "Tem risco em alterar isso?", "Qual é a configuração recomendada?"],
  },
};

function getSupportContent(activeSection: string): SupportContent {
  return supportContentBySection[activeSection] ?? {
    title: "Suporte com IA",
    description: "A Noah ajuda explica a área atual, reduz erro operacional e orienta o próximo passo dentro do sistema.",
    focus: ["Explicar a tela", "Orientar o processo", "Reduzir erros operacionais"],
    prompts: ["Me explica esta área", "O que eu faço aqui agora?", "Qual o próximo passo correto?"],
  };
}

function isItemActive(item: MenuItem, activeSection: string) {
  if (item.section === activeSection) return true;
  if (item.section === "financeiro") {
    return ["financeiro", "custos-fixos", "extratos", "contas", "contas-a-pagar", "cartao-de-credito", "emprestimos"].includes(activeSection);
  }
  if (item.section === "contas") {
    return ["contas", "contas-a-pagar", "cartao-de-credito", "emprestimos"].includes(activeSection);
  }
  if (item.section === "produtos") {
    return ["produtos", "catalogo-ml", "lista-compras"].includes(activeSection);
  }
  if (item.section === "marketing") {
    return ["marketing", "facebook-ads", "instagram", "studio"].includes(activeSection);
  }
  if (item.section === "agentes") {
    return activeSection === "agentes" || activeSection.startsWith("agente-");
  }
  if (item.section === "configuracoes") {
    return activeSection === "configuracoes" || activeSection.startsWith("config-");
  }
  return false;
}

export default function DashboardLayout({
  children,
  onNavigate,
  activeSection = "dashboard",
}: DashboardLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent
        setSidebarWidth={setSidebarWidth}
        onNavigate={onNavigate}
        activeSection={activeSection}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  onNavigate?: (section: string) => void;
  activeSection: string;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  onNavigate,
  activeSection,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const [, setLocation] = useLocation();
  const isCollapsed = state === "collapsed";
  const { theme, toggleTheme } = useTheme();
  const [isResizing, setIsResizing] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const role = (user?.role === "admin" ? "admin" : "user") as AppRole;
  const supportContent = useMemo(() => getSupportContent(activeSection), [activeSection]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({
    financeiro: ["financeiro", "custos-fixos", "extratos", "contas", "contas-a-pagar", "cartao-de-credito", "emprestimos"].includes(activeSection),
    contas: ["contas", "contas-a-pagar", "cartao-de-credito", "emprestimos"].includes(activeSection),
    marketing: ["marketing", "facebook-ads", "instagram", "studio"].includes(activeSection),
    produtos: ["produtos", "catalogo-ml", "lista-compras"].includes(activeSection),
    agentes: activeSection === "agentes" || activeSection.startsWith("agente-"),
    configuracoes: activeSection === "configuracoes" || activeSection.startsWith("config-"),
  }));
  const sidebarRef = useRef<HTMLDivElement>(null);
  const availableMenuItems = useMemo(() => {
    return menuItems.filter((item) => !item.roles || item.roles.includes(role));
  }, [role]);
  const activeMenuItem = availableMenuItems.find(item => isItemActive(item, activeSection) && !item.indent && !item.hiddenFromMenu) ?? availableMenuItems[0] ?? menuItems[0];
  const isMobile = useIsMobile();
  const visibleMenuItems = useMemo(() => {
    return availableMenuItems.filter((item) => {
      if (item.hiddenFromMenu) return false;
      if (!item.indent) return true;
      return Boolean(item.parentSection && expandedSections[item.parentSection]);
    });
  }, [availableMenuItems, expandedSections]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (["financeiro", "custos-fixos", "extratos", "contas", "contas-a-pagar", "cartao-de-credito", "emprestimos"].includes(activeSection)) {
      setExpandedSections((current) => ({ ...current, financeiro: true }));
    }
    if (["contas", "contas-a-pagar", "cartao-de-credito", "emprestimos"].includes(activeSection)) {
      setExpandedSections((current) => ({ ...current, contas: true }));
    }
    if (["produtos", "catalogo-ml", "lista-compras"].includes(activeSection)) {
      setExpandedSections((current) => ({ ...current, produtos: true }));
    }
    if (["marketing", "facebook-ads", "instagram", "studio"].includes(activeSection)) {
      setExpandedSections((current) => ({ ...current, marketing: true }));
    }
    if (activeSection === "agentes" || activeSection.startsWith("agente-")) {
      setExpandedSections((current) => ({ ...current, agentes: true }));
    }
    if (activeSection === "configuracoes" || activeSection.startsWith("config-")) {
      setExpandedSections((current) => ({ ...current, configuracoes: true }));
    }
  }, [activeSection]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const supportPanel = (
    <div className="space-y-5">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Bot className="h-4 w-4" />
          <span className="text-sm font-semibold">Noah ajuda</span>
        </div>
        <h3 className="text-base font-semibold text-foreground">{supportContent.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{supportContent.description}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que fazer aqui</p>
        <div className="space-y-2">
          {supportContent.focus.map((item) => (
            <div key={item} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-sm text-foreground">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perguntas rápidas</p>
        <div className="flex flex-col gap-2">
          {supportContent.prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="rounded-xl border border-border/50 bg-background px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {supportContent.warning ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-sm text-amber-200">
          <span className="font-medium text-amber-300">Atenção:</span> {supportContent.warning}
        </div>
      ) : null}

      <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
        Esta é a primeira versão do suporte lateral. O próximo passo é conectar respostas reais, histórico e ação guiada por usuário/perfil.
      </div>
    </div>
  );

  if (isMobile) {
    const allTopItems = visibleMenuItems.filter(item => !item.indent);
    const bottomBarSections = role === "admin"
      ? ["dashboard", "pedidos", "produtos", "financeiro"]
      : ["dashboard", "pedidos", "produtos"];
    const bottomBarItems = bottomBarSections.map(s => allTopItems.find(i => i.section === s)).filter(Boolean) as MenuItem[];
    const drawerItems = [
      ...allTopItems.filter(i => !bottomBarSections.includes(i.section)),
      ...visibleMenuItems.filter(i => i.indent),
    ];

    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b border-border/50 bg-background/95 px-4 py-2 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2.5">
            <activeMenuItem.icon className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">{activeMenuItem.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 border border-border/50">
                    <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "K"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{user?.name || "Usuário"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
                </div>
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-24">
          {children}
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur">
          <div className="flex items-stretch justify-around px-1 py-1">
            {bottomBarItems.map(item => {
              const isActive = isItemActive(item, activeSection);
              return (
                <button
                  key={item.section}
                  onClick={() => setLocation(item.href)}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div className="relative">
                    <item.icon className="h-5 w-5" />
                    {item.badge === "dot-green" && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                </button>
              );
            })}

            {/* Botão Mais → Sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-muted-foreground">
                  <Menu className="h-5 w-5" />
                  <span className="text-[9px] font-medium leading-tight">Mais</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-background pb-8">
                <SheetHeader className="mb-4">
                  <SheetTitle className="text-left text-sm text-muted-foreground">Navegação</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-3">
                  {drawerItems.map(item => {
                    const isActive = isItemActive(item, activeSection);
                    return (
                      <Sheet key={item.section}>
                        <button
                          onClick={() => setLocation(item.href)}
                          className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                            isActive
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-border/30 bg-muted/20 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="relative">
                            <item.icon className="h-5 w-5" />
                            {item.badge === "dot-green" && (
                              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                            )}
                          </div>
                          <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight">{item.label}</span>
                        </button>
                      </Sheet>
                    );
                  })}
                </div>
                <div className="mt-6 border-t border-border/30 pt-4">
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    );
  }

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border/30" disableTransition={isResizing}>
          <SidebarHeader className="h-18 justify-center border-b border-sidebar-border/30 px-2">
            <div className="flex w-full items-center gap-3 px-2 transition-all">
              <button
                onClick={toggleSidebar}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Alternar navegação"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-base font-bold tracking-tight text-primary">
                    Kaibren
                  </p>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    Command Center
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-3">
            <SidebarMenu className="gap-0.5">
              {visibleMenuItems.map(item => {
                const isActive = isItemActive(item, activeSection);
                const isExpandable = ["produtos", "financeiro", "contas", "marketing", "agentes", "configuracoes"].includes(item.section);
                const isExpanded = expandedSections[item.section];
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        if (isExpandable) {
                          setExpandedSections((current) => ({
                            ...current,
                            [item.section]: !current[item.section],
                          }));
                          return;
                        }

                        if (item.parentSection) {
                          const parentKey = item.parentSection as string;
                          setExpandedSections((current) => ({
                            ...current,
                            [parentKey]: false,
                          }));
                        }

                        setLocation(item.href);
                      }}
                      tooltip={item.label}
                      className={`h-10 font-normal transition-all ${item.indent ? "ml-4 w-[calc(100%-1rem)]" : ""} ${
                        isActive
                          ? "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                      }`}
                    >
                      <div className="relative">
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        {item.badge === "dot-green" && (
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse-dot" />
                        )}
                      </div>
                      <span className="flex-1 text-left">{item.label}</span>
                      {isExpandable ? <span className="text-xs text-muted-foreground">{isExpanded ? "−" : "+"}</span> : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/30 p-3 space-y-2">
            <button
              onClick={toggleTheme}
              className="group-data-[collapsible=icon]:justify-center flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
              <span className="group-data-[collapsible=icon]:hidden">{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group-data-[collapsible=icon]:justify-center flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 shrink-0 border border-border/50">
                    <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "K"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="group-data-[collapsible=icon]:hidden min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-none text-foreground">
                      {user?.name || "Usuário"}
                    </p>
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {user?.email || "Sem e-mail"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        <main className="flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-6 2xl:p-8">{children}</main>

      </SidebarInset>
    </>
  );
}
