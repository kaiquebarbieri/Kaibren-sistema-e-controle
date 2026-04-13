import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";
import AcessoNegado from "@/pages/AcessoNegado";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";

// Lazy-loaded pages — only downloaded when the user navigates to them
const Customers = lazy(() => import("@/pages/Customers"));
const Orders = lazy(() => import("@/pages/Orders"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const Products = lazy(() => import("@/pages/Products"));
const BankStatements = lazy(() => import("@/pages/BankStatements"));
const Finance = lazy(() => import("@/pages/Finance"));
const CustosFixos = lazy(() => import("@/pages/CustosFixos"));
const Obligations = lazy(() => import("@/pages/Obligations"));
const Agent = lazy(() => import("@/pages/Agent"));
const Team = lazy(() => import("@/pages/Team"));
const MetaAds = lazy(() => import("@/pages/MetaAds"));
const FacebookAds = lazy(() => import("@/pages/FacebookAds"));
const InstagramPage = lazy(() => import("@/pages/Instagram"));
const AfiliadoNutra = lazy(() => import("@/pages/AfiliadoNutra"));
const CatalogoAtacado = lazy(() => import("@/pages/CatalogoAtacado"));
const StudioCriativos = lazy(() => import("@/pages/StudioCriativos"));
const Agentes = lazy(() => import("@/pages/Agentes"));
const AgentDetail = lazy(() => import("@/pages/AgentDetail"));
const Relatorios = lazy(() => import("@/pages/Relatorios"));
const ListaCompras = lazy(() => import("@/pages/ListaCompras"));
const Settings = lazy(() => import("@/pages/Settings"));
const CatalogoML = lazy(() => import("@/pages/CatalogoML"));
const Operacional = lazy(() => import("@/pages/Operacional"));
const Estoque = lazy(() => import("@/pages/Estoque"));
const RelatoriosExec = lazy(() => import("@/pages/RelatoriosExec"));
const Auditoria = lazy(() => import("@/pages/Auditoria"));
const Mensagens = lazy(() => import("@/pages/Mensagens"));
const ShopeeIntelligence = lazy(() => import("@/pages/ShopeeIntelligence"));
const NoahVoice = lazy(() => import("@/pages/NoahVoice"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Carregando...</span>
      </div>
    </div>
  );
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return null;
  if (user.role !== "admin") return <AcessoNegado />;

  return <>{children}</>;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route path={"/"} component={Dashboard} />
        <Route path={"/operacional"}>{() => <Operacional />}</Route>
        <Route path={"/clientes"}>{() => <Customers />}</Route>
        <Route path={"/produtos"}>{() => <Products />}</Route>
        <Route path={"/pedidos"}>{() => <Orders />}</Route>
        <Route path={"/marketing"}>{() => <AdminOnly><Marketing /></AdminOnly>}</Route>
        <Route path={"/marketing/facebook-ads"}>{() => <AdminOnly><FacebookAds /></AdminOnly>}</Route>
        <Route path={"/marketing/instagram"}>{() => <AdminOnly><InstagramPage /></AdminOnly>}</Route>
        <Route path={"/meta-ads"}>{() => <AdminOnly><MetaAds /></AdminOnly>}</Route>
        <Route path={"/instagram"}>{() => <AdminOnly><InstagramPage /></AdminOnly>}</Route>
        <Route path={"/extratos"}>{() => <AdminOnly><BankStatements /></AdminOnly>}</Route>
        <Route path={"/extratos/:id"}>{() => <AdminOnly><BankStatements /></AdminOnly>}</Route>
        <Route path={"/financeiro"}>{() => <AdminOnly><Finance /></AdminOnly>}</Route>
        <Route path={"/financeiro/custos-fixos"}>{() => <AdminOnly><CustosFixos /></AdminOnly>}</Route>
        <Route path={"/equipe"}>{() => <AdminOnly><Team /></AdminOnly>}</Route>
        <Route path={"/agente"}>{() => <AdminOnly><Agent /></AdminOnly>}</Route>
        <Route path={"/agentes"}>{() => <AdminOnly><Agentes /></AdminOnly>}</Route>
        <Route path={"/agentes/:slug"}>{(params) => <AdminOnly><AgentDetail params={params} /></AdminOnly>}</Route>
        <Route path={"/relatorios"}>{() => <AdminOnly><Relatorios /></AdminOnly>}</Route>
        <Route path={"/lista-compras"}>{() => <AdminOnly><ListaCompras /></AdminOnly>}</Route>
        <Route path={"/afiliado-nutra"}>{() => <AdminOnly><AfiliadoNutra /></AdminOnly>}</Route>
        <Route path={"/catalogo-atacado"}>{() => <AdminOnly><CatalogoAtacado /></AdminOnly>}</Route>
        <Route path={"/studio"}>{() => <AdminOnly><StudioCriativos /></AdminOnly>}</Route>
        <Route path={"/estoque"}>{() => <AdminOnly><Estoque /></AdminOnly>}</Route>
        <Route path={"/relatorios-exec"}>{() => <AdminOnly><RelatoriosExec /></AdminOnly>}</Route>
        <Route path={"/auditoria"}>{() => <AdminOnly><Auditoria /></AdminOnly>}</Route>
        <Route path={"/mensagens"}>{() => <Mensagens />}</Route>
        <Route path={"/shopee"}>{() => <AdminOnly><ShopeeIntelligence /></AdminOnly>}</Route>
        <Route path={"/noah"}>{() => <AdminOnly><NoahVoice /></AdminOnly>}</Route>
        <Route path={"/catalogo-ml"}>{() => <AdminOnly><CatalogoML /></AdminOnly>}</Route>
        <Route path={"/configuracoes"}>{() => <AdminOnly><Settings /></AdminOnly>}</Route>
        <Route path={"/contas"}>{() => <AdminOnly><Obligations /></AdminOnly>}</Route>
        <Route path={"/contas/:tab"}>{() => <AdminOnly><Obligations /></AdminOnly>}</Route>
        <Route path={"/obrigacoes"}>{() => <AdminOnly><Obligations /></AdminOnly>}</Route>
        <Route path={"/obrigacoes/:tab"}>{() => <AdminOnly><Obligations /></AdminOnly>}</Route>
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
