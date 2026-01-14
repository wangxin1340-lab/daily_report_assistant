import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Chat from "./pages/Chat";
import History from "./pages/History";
import ReportDetail from "./pages/ReportDetail";
import Settings from "./pages/Settings";
import OKR from "./pages/OKR";
import WeeklyReport from "./pages/WeeklyReport";
import WeeklyReportHistory from "./pages/WeeklyReportHistory";
import WeeklyReportDetail from "./pages/WeeklyReportDetail";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Chat} />
        <Route path="/chat/:id" component={Chat} />
        <Route path="/history" component={History} />
        <Route path="/report/:id" component={ReportDetail} />
        <Route path="/okr" component={OKR} />
        <Route path="/weekly-report" component={WeeklyReport} />
        <Route path="/weekly-report-history" component={WeeklyReportHistory} />
        <Route path="/weekly-report/:id" component={WeeklyReportDetail} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
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
