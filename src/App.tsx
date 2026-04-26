import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Leads from "./pages/Leads";
import Dispatch from "./pages/Dispatch";
import Estimates from "./pages/Estimates";
import Customers from "./pages/Customers";
import Invoices from "./pages/Invoices";
import Team from "./pages/Team";
import PriceBook from "./pages/PriceBook";
import Inventory from "./pages/Inventory";
import Messages from "./pages/Messages";
import Reports from "./pages/Reports";
import ServiceAreas from "./pages/ServiceAreas";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import PortalInvoice from "./pages/PortalInvoice";
import PortalEstimate from "./pages/PortalEstimate";
import FieldView from "./pages/FieldView";

const queryClient = new QueryClient();

const protectedRoutes: { path: string; element: React.ReactNode }[] = [
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/leads", element: <Leads /> },
  { path: "/jobs", element: <Jobs /> },
  { path: "/jobs/:id", element: <JobDetail /> },
  { path: "/dispatch", element: <Dispatch /> },
  { path: "/customers", element: <Customers /> },
  { path: "/estimates", element: <Estimates /> },
  { path: "/invoices", element: <Invoices /> },
  { path: "/team", element: <Team /> },
  { path: "/price-book", element: <PriceBook /> },
  { path: "/inventory", element: <Inventory /> },
  { path: "/messages", element: <Messages /> },
  { path: "/reports", element: <Reports /> },
  { path: "/service-areas", element: <ServiceAreas /> },
  { path: "/settings", element: <Settings /> },
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/portal/invoice/:token" element={<PortalInvoice />} />
              <Route path="/portal/estimate/:token" element={<PortalEstimate />} />
              <Route path="/field" element={<ProtectedRoute><FieldView /></ProtectedRoute>} />
              {protectedRoutes.map((r) => (
                <Route
                  key={r.path}
                  path={r.path}
                  element={<ProtectedRoute><AppShell>{r.element}</AppShell></ProtectedRoute>}
                />
              ))}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
