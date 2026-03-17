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
  ClipboardList,
  LogOut,
  PackageSearch,
  PanelLeft,
  UserPlus,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: BarChart3, label: "Dashboard", section: "dashboard", href: "/" },
  { icon: UserPlus, label: "Clientes", section: "clientes", href: "/clientes" },
  { icon: PackageSearch, label: "Produtos", section: "produtos", href: "/produtos" },
  { icon: ClipboardList, label: "Pedidos", section: "pedidos", href: "/pedidos" },
] as const;

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

type DashboardLayoutProps = {
  children: React.ReactNode;
  onNavigate?: (section: string) => void;
  activeSection?: string;
};

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
  const activeMenuItem = menuItems.find(item => item.section === activeSection) ?? menuItems[0];
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

  /* ── Mobile layout: bottom nav bar ── */
  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Mobile top header */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
          <div className="flex items-center gap-3">
            <activeMenuItem.icon className="h-5 w-5 text-primary" />
            <span className="text-base font-semibold tracking-tight text-foreground">{activeMenuItem.label}</span>
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

        {/* Main content with bottom padding for nav bar */}
        <main className="flex-1 overflow-y-auto px-3 py-4 pb-20">
          {children}
        </main>

        {/* Bottom navigation bar - fixed */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur safe-area-bottom">
          <div className="flex h-16 items-center justify-around px-2">
            {menuItems.map(item => {
              const isActive = item.section === activeSection;
              return (
                <button
                  key={item.section}
                  onClick={() => {
                    setLocation(item.href);
                    onNavigate?.(item.section);
                  }}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 transition-colors min-w-[64px] ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  <span className={`text-[11px] font-medium leading-none ${isActive ? "text-primary" : ""}`}>
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

  /* ── Desktop layout: sidebar ── */
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
                    Gestão de pedidos e margens
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-3">
            <SidebarMenu className="gap-1">
              {menuItems.map(item => {
                const isActive = item.section === activeSection;
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        setLocation(item.href);
                        onNavigate?.(item.section);
                      }}
                      tooltip={item.label}
                      className="h-10 font-normal"
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
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
