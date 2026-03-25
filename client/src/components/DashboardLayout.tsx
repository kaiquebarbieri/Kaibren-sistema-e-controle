import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Bot,
  ClipboardList,
  CreditCard,
  FileText,
  Landmark,
  LogOut,
  Megaphone,
  PackageSearch,
  PanelLeft,
  ReceiptText,
  UserPlus,
  Wallet,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

type MenuItem = {
  icon: any;
  label: string;
  section: string;
  href: string;
  indent?: boolean;
};

const menuItems: MenuItem[] = [
  { icon: BarChart3, label: "Dashboard", section: "dashboard", href: "/" },
  { icon: UserPlus, label: "Clientes", section: "clientes", href: "/clientes" },
  { icon: PackageSearch, label: "Produtos", section: "produtos", href: "/produtos" },
  { icon: ClipboardList, label: "Pedidos", section: "pedidos", href: "/pedidos" },
  { icon: Megaphone, label: "Marketing", section: "marketing", href: "/marketing" },
  { icon: FileText, label: "Extratos", section: "extratos", href: "/extratos" },
  { icon: Wallet, label: "Financeiro", section: "financeiro", href: "/financeiro" },
  { icon: ReceiptText, label: "Contas", section: "contas", href: "/contas/contas-a-pagar" },
  { icon: ReceiptText, label: "Contas a Pagar", section: "contas-a-pagar", href: "/contas/contas-a-pagar", indent: true },
  { icon: CreditCard, label: "Cartão de Crédito", section: "cartao-de-credito", href: "/contas/cartao-de-credito", indent: true },
  { icon: Landmark, label: "Empréstimos", section: "emprestimos", href: "/contas/emprestimos", indent: true },
  { icon: Bot, label: "Agente", section: "agente", href: "/agente" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

type DashboardLayoutProps = {
  children: React.ReactNode;
  onNavigate?: (section: string) => void;
  activeSection?: string;
};

function isItemActive(item: MenuItem, activeSection: string) {
  if (item.section === activeSection) return true;
  if (item.section === "contas") {
    return ["contas", "contas-a-pagar", "cartao-de-credito", "emprestimos"].includes(activeSection);
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-8 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Entrar no Sistema CK Distribuidora
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              O acesso a este painel exige autenticação para proteger produtos, pedidos, margens e histórico financeiro.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full"
          >
            Entrar no painel
          </Button>
        </div>
      </div>
    );
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
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => isItemActive(item, activeSection) && !item.indent) ?? menuItems[0];
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

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

  if (isMobile) {
    const mobileItems = menuItems.filter(item => !item.indent);
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <activeMenuItem.icon className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">{activeMenuItem.label}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback className="text-xs font-medium">
                    {user?.name?.charAt(0).toUpperCase() || "C"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{user?.name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
              </div>
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-24 sm:px-4">
          {children}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 px-1 backdrop-blur supports-[backdrop-filter]:backdrop-blur safe-area-bottom">
          <div className="mx-auto grid h-auto max-w-screen-sm grid-cols-4 gap-1 py-2">
            {mobileItems.map(item => {
              const isActive = isItemActive(item, activeSection);
              return (
                <button
                  key={item.section}
                  onClick={() => {
                    setLocation(item.href);
                    onNavigate?.(item.section);
                  }}
                  className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-colors sm:px-2 ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                  <span className={`line-clamp-2 text-[10px] font-medium leading-tight sm:text-[11px] ${isActive ? "text-primary" : ""}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-18 justify-center border-b border-sidebar-border/70 px-2">
            <div className="flex w-full items-center gap-3 px-2 transition-all">
              <button
                onClick={toggleSidebar}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Alternar navegação"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-muted-foreground">CK Distribuidora</p>
                  <span className="truncate text-base font-semibold tracking-tight text-foreground">
                    Gestão operacional e financeira
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-3">
            <SidebarMenu className="gap-1">
              {menuItems.map(item => {
                const isActive = isItemActive(item, activeSection);
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        setLocation(item.href);
                        onNavigate?.(item.section);
                      }}
                      tooltip={item.label}
                      className={`h-10 font-normal ${item.indent ? "ml-4 w-[calc(100%-1rem)]" : ""}`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/70 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group-data-[collapsible=icon]:justify-center flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 shrink-0 border">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase() || "C"}
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
