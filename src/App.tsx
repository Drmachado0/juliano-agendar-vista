import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";

import PoliticaPrivacidade from "./pages/PoliticaPrivacidade";
import NotFound from "./pages/NotFound";
import ConsentBanner from "./components/ConsentBanner";

import RouteChangeTracker from "./components/RouteChangeTracker";
import ScrollToTop from "./components/ScrollToTop";

// Code-splitting: a página pública /agendamento e toda a área /admin
// vivem em chunks separados — não pesam no bundle inicial da home.
const Agendamento = lazy(() => import("./pages/Agendamento"));
// Baixo trafego e ambas puxam o Supabase: como imports estaticos, colocavam
// 48 KB gzip no caminho critico de toda visita para servir duas paginas que
// a maioria nunca abre.
const Obrigado = lazy(() => import("./pages/Obrigado"));
const Auth = lazy(() => import("./pages/Auth"));
const Paragominas = lazy(() => import("./pages/Paragominas"));
const Sobre = lazy(() => import("./pages/Sobre"));
const Belem = lazy(() => import("./pages/Belem"));
const ParagominasAgendamento = lazy(() => import("./pages/ParagominasAgendamento"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminAgendamentos = lazy(() => import("./pages/admin/Agendamentos"));
const AdminCRM = lazy(() => import("./pages/admin/CRM"));
const AdminWhatsApp = lazy(() => import("./pages/admin/WhatsApp"));
const AdminAgenda = lazy(() => import("./pages/admin/Agenda"));
const AdminDisponibilidade = lazy(() => import("./pages/admin/Disponibilidade"));
const AdminProfissionais = lazy(() => import("./pages/admin/Profissionais"));
const AdminConfiguracoes = lazy(() => import("./pages/admin/Configuracoes"));
const AdminAvaliacoes = lazy(() => import("./pages/admin/Avaliacoes"));
const AdminLembretes = lazy(() => import("./pages/admin/Lembretes"));
const AdminWebhooks = lazy(() => import("./pages/admin/Webhooks"));
const AdminAuditoriaTracking = lazy(() => import("./pages/admin/AuditoriaTracking"));
const AdminLogs = lazy(() => import("./pages/admin/Logs"));
const AdminLGPD = lazy(() => import("./pages/admin/LGPD"));
const AdminRelatorios = lazy(() => import("./pages/admin/Relatorios"));
const AdminSaudeIntegracoes = lazy(() => import("./pages/admin/SaudeIntegracoes"));
const AdminMonitoramentoCrm = lazy(() => import("./pages/admin/MonitoramentoCrm"));
const ProcedimentosIndex = lazy(() => import("./pages/procedimentos/Index"));
const ProcCatarata = lazy(() => import("./pages/procedimentos/CirurgiaDeCatarata"));
const ProcPterigio = lazy(() => import("./pages/procedimentos/CirurgiaDePterigio"));
const ProcConsulta = lazy(() => import("./pages/procedimentos/ConsultaOftalmologica"));
const ProcYagLaser = lazy(() => import("./pages/procedimentos/CapsulotomiaYagLaser"));
const ProcGlaucoma = lazy(() => import("./pages/procedimentos/Glaucoma"));
const ProcMapeamento = lazy(() => import("./pages/procedimentos/MapeamentoDeRetina"));
const ProcRetinografia = lazy(() => import("./pages/procedimentos/Retinografia"));
const ProcTonometria = lazy(() => import("./pages/procedimentos/Tonometria"));
const ProcGonioscopia = lazy(() => import("./pages/procedimentos/Gonioscopia"));
const ProcBiometria = lazy(() => import("./pages/procedimentos/BiometriaUltrassonica"));
const ProcIridotomia = lazy(() => import("./pages/procedimentos/IridotomiaLaser"));

const queryClient = new QueryClient();

const RedirectToAgendamento = () => {
  const location = useLocation();
  return <Navigate to={`/agendamento${location.search}${location.hash}`} replace />;
};

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

/**
 * Envolve apenas as rotas que precisam de sessao.
 *
 * POR QUE: o AuthProvider envolvia o app inteiro, e ele consulta a sessao no
 * useEffect de montagem. Resultado: o cliente Supabase era necessario em TODA
 * pagina, inclusive nas 18 rotas publicas que nunca leem sessao — 48,2 KB gzip
 * dentro de um caminho critico de 250 KB.
 *
 * Passar os imports para dinamico (41a8839) foi necessario mas nao suficiente:
 * enquanto o bootstrap rodasse em pagina publica, o chunk carregava em pagina
 * publica, e o Vite o pre-carregava com razao.
 *
 * Verificado antes de mover: NENHUM componente publico chama useAuth(). Os
 * consumidores sao AdminLayout, tres paginas /admin, dois modais de admin e a
 * propria /auth — todos abaixo desta rota de layout.
 */
const RotasAutenticadas = () => (
  <AuthProvider>
    <Outlet />
  </AuthProvider>
);

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <Toaster />
          <Sonner closeButton richColors position="top-right" />
          <BrowserRouter>
          <RouteChangeTracker />
          <ScrollToTop />
          <ConsentBanner />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/agendar" element={<RedirectToAgendamento />} />
              <Route path="/agendar-consulta" element={<RedirectToAgendamento />} />
              <Route path="/agendamento" element={<Agendamento />} />
              <Route path="/paragominas" element={<Paragominas />} />
              <Route path="/belem" element={<Belem />} />
              <Route path="/paragominas/agendamento" element={<ParagominasAgendamento />} />
              <Route path="/procedimentos" element={<ProcedimentosIndex />} />
              <Route path="/procedimentos/cirurgia-de-catarata" element={<ProcCatarata />} />
              <Route path="/procedimentos/cirurgia-de-pterigio" element={<ProcPterigio />} />
              <Route path="/procedimentos/consulta-oftalmologica" element={<ProcConsulta />} />
              <Route path="/procedimentos/capsulotomia-yag-laser" element={<ProcYagLaser />} />
              <Route path="/procedimentos/glaucoma" element={<ProcGlaucoma />} />
              <Route path="/procedimentos/mapeamento-de-retina" element={<ProcMapeamento />} />
              <Route path="/procedimentos/retinografia" element={<ProcRetinografia />} />
              <Route path="/procedimentos/tonometria" element={<ProcTonometria />} />
              <Route path="/procedimentos/gonioscopia" element={<ProcGonioscopia />} />
              <Route path="/procedimentos/biometria-ultrassonica" element={<ProcBiometria />} />
              <Route path="/procedimentos/iridotomia-a-laser" element={<ProcIridotomia />} />
              <Route path="/obrigado" element={<Obrigado />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
              <Route element={<RotasAutenticadas />}>
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
              <Route path="/admin/configuracoes/webhooks" element={<AdminWebhooks />} />
              <Route path="/admin/auditoria-tracking" element={<AdminAuditoriaTracking />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/lgpd" element={<AdminLGPD />} />
              <Route path="/admin/relatorios" element={<AdminRelatorios />} />
              <Route path="/admin/saude-integracoes" element={<AdminSaudeIntegracoes />} />
              <Route path="/admin/monitoramento-crm" element={<AdminMonitoramentoCrm />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
