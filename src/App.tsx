import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { BASE_URL } from "@/lib/locations";
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

/**
 * /agendar e /agendar-consulta apontam para /agendamento.
 *
 * ISTO NAO E UM 301, E O QUE DA PARA FAZER SEM O HOST. O redirecionamento aqui
 * e do React Router, entao so acontece depois que o JS roda. Para o servidor as
 * duas URLs respondem 200, e ate 29/08/2026 respondiam com o HTML da home,
 * porque nao estavam pre renderizadas e caiam no fallback da SPA. O Google via
 * duas copias indexaveis da home.
 *
 * O 301 de verdade exigiria regra no host. A auditoria de 28/08 registrou isso
 * como tarefa de painel do Cloudflare, e em 29/08 descobrimos que o Cloudflare
 * no caminho e da Lovable, nao do medico: os nameservers do dominio sao da
 * Hostinger, ns1 e ns2.dns-parking.com. Nao ha painel para criar a regra.
 *
 * O QUE ESTAS TAGS RESOLVEM: com as duas rotas em scripts/rotas-extra.mjs, o
 * SSG gera HTML proprio para elas, e esse HTML diz noindex e aponta o canonical
 * para /agendamento. O Google para de indexar as duas e entende qual e a pagina
 * real. O efeito chega perto do 301, sem ser um.
 *
 * A query string e o hash seguem para o destino, porque campanha paga usa
 * utm_source e perder isso quebraria a atribuicao.
 */
const RedirectToAgendamento = () => {
  const location = useLocation();
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={`${BASE_URL}/agendamento`} />
        {/*
          Titulo e OG repetem os de /agendamento de proposito.
          Enquanto estas rotas serviam a casca da home, elas herdavam o titulo e
          a previa dela. Ao ganharem HTML proprio em 29/08/2026, o montar() do
          ssg.mjs passou a remover os OG da casca e o Helmet nao repunha nada:
          saiam com <title> vazio e sem previa nenhuma.
          Isso importa mais aqui que na maioria das paginas. Sao as URLs curtas
          que vao em campanha paga e em link colado no WhatsApp, e previa sem
          titulo parece link quebrado antes de qualquer um clicar.
        */}
        <title>Agendar Consulta — Dr. Juliano Machado | Oftalmologista</title>
        <meta
          name="description"
          content="Agende sua consulta com Dr. Juliano Machado: oftalmologista 5 estrelas em Paragominas e Belém. Agendamento online ou direto com nossa secretária pelo WhatsApp."
        />
        <meta property="og:title" content="Agendar Consulta — Dr. Juliano Machado | Oftalmologista" />
        <meta
          property="og:description"
          content="Agende sua consulta com Dr. Juliano Machado: oftalmologista 5 estrelas em Paragominas e Belém."
        />
        <meta property="og:url" content={`${BASE_URL}/agendamento`} />
      </Helmet>
      {/*
        So no cliente. No servidor o React Router avisa que <Navigate> na
        primeira renderizacao dentro de StaticRouter e no-op, e imprimia isso
        duas vezes por build. Aviso que aparece sempre e aviso que ninguem le.
      */}
      {typeof window === "undefined" ? null : (
        <Navigate to={`/agendamento${location.search}${location.hash}`} replace />
      )}
    </>
  );
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

/**
 * Provedores que nao dependem de roteador.
 *
 * POR QUE ESTA SEPARADO: o build de SSG (scripts/og-por-rota.mjs via
 * src/entry-server.tsx) precisa trocar o BrowserRouter por StaticRouter e
 * passar um `context` ao HelmetProvider para coletar as tags do <head>. Sem
 * esta separacao, seria preciso duplicar toda a arvore de provedores no
 * servidor, e as duas copias divergiriam na primeira mudanca.
 */
export const AppProvedores = ({
  helmetContext,
  children,
}: {
  helmetContext?: Record<string, unknown>;
  children: React.ReactNode;
}) => (
  <HelmetProvider context={helmetContext}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner closeButton richColors position="top-right" />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

/** Conteudo que vive dentro do roteador. Compartilhado por cliente e servidor. */
export const AppConteudo = () => (
  <>
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
  </>
);

const App = () => (
  <AppProvedores>
    <BrowserRouter>
      <AppConteudo />
    </BrowserRouter>
  </AppProvedores>
);

export default App;
