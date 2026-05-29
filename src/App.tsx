import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Agendamento from "./pages/Agendamento";
import Obrigado from "./pages/Obrigado";
import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import NotFound from "./pages/NotFound";
import ConsentBanner from "./components/ConsentBanner";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminAgendamentos from "./pages/admin/Agendamentos";
import AdminCRM from "./pages/admin/CRM";
import AdminWhatsApp from "./pages/admin/WhatsApp";
import AdminAgenda from "./pages/admin/Agenda";
import AdminDisponibilidade from "./pages/admin/Disponibilidade";
import AdminProfissionais from "./pages/admin/Profissionais";
import AdminConfiguracoes from "./pages/admin/Configuracoes";
import AdminAvaliacoes from "./pages/admin/Avaliacoes";
import AdminLembretes from "./pages/admin/Lembretes";
import AdminWebhooks from "./pages/admin/Webhooks";
import AdminAuditoriaTracking from "./pages/admin/AuditoriaTracking";
import AdminLogs from "./pages/admin/Logs";

import AdminLGPD from "./pages/admin/LGPD";
import AdminRelatorios from "./pages/admin/Relatorios";

import RouteChangeTracker from "./components/RouteChangeTracker";

const queryClient = new QueryClient();

const RedirectToAgendamento = () => {
  const location = useLocation();
  return <Navigate to={`/agendamento${location.search}${location.hash}`} replace />;
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner closeButton richColors position="top-right" />
          <BrowserRouter>
          <RouteChangeTracker />
          <ConsentBanner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/agendar" element={<RedirectToAgendamento />} />
            <Route path="/agendar-consulta" element={<RedirectToAgendamento />} />
            <Route path="/agendamento" element={<Agendamento />} />
            <Route path="/obrigado" element={<Obrigado />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/agendamentos" element={<AdminAgendamentos />} />
              <Route path="/admin/agenda" element={<AdminAgenda />} />
              <Route path="/admin/disponibilidade" element={<AdminDisponibilidade />} />
              <Route path="/admin/profissionais" element={<AdminProfissionais />} />
              <Route path="/admin/crm" element={<AdminCRM />} />
              <Route path="/admin/lembretes" element={<AdminLembretes />} />
              <Route path="/admin/avaliacoes" element={<AdminAvaliacoes />} />
              <Route path="/admin/whatsapp" element={<AdminWhatsApp />} />
              
              <Route path="/admin/configuracoes" element={<AdminConfiguracoes />} />
              <Route path="/admin/configuracoes/evolution" element={<AdminConfiguracoesEvolution />} />
              <Route path="/admin/configuracoes/webhooks" element={<AdminWebhooks />} />
              <Route path="/admin/auditoria-tracking" element={<AdminAuditoriaTracking />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/lgpd" element={<AdminLGPD />} />
              <Route path="/admin/relatorios" element={<AdminRelatorios />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
