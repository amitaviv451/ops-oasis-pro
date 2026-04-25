import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/AppShell";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Leads from "./pages/Leads";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const appRoutes: { path: string; title: string }[] = [
  { path: "/leads", title: "Leads" },
  { path: "/dispatch", title: "Dispatch" },
  { path: "/customers", title: "Customers" },
  { path: "/estimates", title: "Estimates" },
  { path: "/invoices", title: "Invoices" },
  { path: "/team", title: "Team" },
  { path: "/price-book", title: "Price Book" },
  { path: "/inventory", title: "Inventory" },
  { path: "/messages", title: "Messages" },
  { path: "/reports", title: "Reports" },
  { path: "/service-areas", title: "Service Areas" },
  { path: "/settings", title: "Settings" },
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><AppShell><Jobs /></AppShell></ProtectedRoute>} />
            {appRoutes.map((r) => (
              <Route key={r.path} path={r.path} element={<ProtectedRoute><AppShell><ComingSoon title={r.title} /></AppShell></ProtectedRoute>} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
