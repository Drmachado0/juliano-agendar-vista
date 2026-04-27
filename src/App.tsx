import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Agendar from "./pages/Agendar";
import AgendarConsulta from "./pages/AgendarConsulta";
import Agendamento from "./pages/Agendamento";
import Obrigado from "./pages/Obrigado";
import NotFound from "./pages/NotFound";
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
import AdminConfiguracoesEvolution from "./pages/admin/ConfiguracoesEvolution";
import AdminAuditoriaTracking from "./pages/admin/AuditoriaTracking";
import AdminLogs from "./pages/admin/Logs";
import AdminHermes from "./pages/admin/Hermes";
import AdminLGPD from "./pages/admin/LGPD";
import AdminRelatorios from "./pages/admin/Relatorios";
import RouteChangeTracker from "./components/RouteChangeTracker";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner closeButton richColors position="top-right" />
          <BrowserRouter>
          <RouteChangeTracker />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/agendar" element={<Agendar />} />
            <Route path="/agendar-consulta" element={<AgendarConsulta />} />
            <Route path="/agendamento" element={<Agendamento />} />
            <Route path="/obrigado" element={<Obrigado />} />
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
              <Route path="/admin/hermes" element={<AdminHermes />} />
              <Route path="/admin/configuracoes" element={<AdminConfiguracoes />} />
              <Route path="/admin/configuracoes/evolution" element={<AdminConfiguracoesEvolution />} />
              <Route path="/admin/auditoria-tracking" element={<AdminAuditoriaTracking />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/lgpd" element={<AdminLGPD />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
