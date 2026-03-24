import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Customers from "@/pages/Customers";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";
import Orders from "@/pages/Orders";
import Marketing from "@/pages/Marketing";
import Products from "@/pages/Products";
import BankStatements from "@/pages/BankStatements";
import Finance from "@/pages/Finance";
import Obligations from "@/pages/Obligations";
import Agent from "@/pages/Agent";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/clientes"} component={Customers} />
      <Route path={"/produtos"} component={Products} />
      <Route path={"/pedidos"} component={Orders} />
      <Route path={"/marketing"} component={Marketing} />
      <Route path={"/extratos"} component={BankStatements} />
      <Route path={"/extratos/:id"} component={BankStatements} />
      <Route path={"/financeiro"} component={Finance} />
      <Route path={"/agente"} component={Agent} />
      <Route path={"/obrigacoes"} component={Obligations} />
      <Route path={"/obrigacoes/:tab"} component={Obligations} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
