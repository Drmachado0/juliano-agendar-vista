import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Tag,
  Activity,
  FileCode,
  RefreshCw,
  XCircle,
  ExternalLink,
  Info,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * AUDITORIA DE TRACKING
 *
 * Cruza inventário estático (hard-coded no repo) com detecção em runtime
 * (GTM, gtag, fbq, dataLayer) e agora também com logs server-side da Meta CAPI
 * gravados em `system_logs` (source='meta-capi').
 *
 * Fonte de verdade do Pixel ID esperado: public.site_config.expected_meta_pixel_id
 * (localStorage é usado apenas como cache otimista pré-hidratação).
 */

type TrackingEntry = {
  type: "GTM" | "GA4" | "Google Ads" | "Meta Pixel" | "DataLayer Event";
  id: string;
  label?: string;
  purpose: string;
  files: string[];
  source: "code" | "gtm-only";
};

const TRACKING_INVENTORY: TrackingEntry[] = [
  {
    type: "GTM",
    id: "GTM-K3C2NNF6",
    purpose: "Container principal — gerencia todas as tags",
    files: ["index.html"],
    source: "code",
  },
  {
    type: "Google Ads",
    id: "AW-436492720",
    label: "tUOICNX06JwcELCzkdAB",
    purpose: "Conversão — Formulário/Agendamento confirmado",
    files: [
      "src/pages/Obrigado.tsx",
      "src/pages/Agendamento.tsx",
      "src/components/scheduling/SchedulingModal.tsx",
    ],
    source: "code",
  },
  {
    type: "Google Ads",
    id: "AW-436492720",
    label: "R5yuCJjn7ZwcELCzkdAB",
    purpose: "Conversão — Clique em telefone",
    files: ["src/hooks/useGoogleTag.ts"],
    source: "code",
  },
  {
    type: "Google Ads",
    id: "AW-436492720",
    label: "-h8XCK3z6JwcELCzkdAB",
    purpose: "Conversão — Clique em WhatsApp",
    files: [
      "src/hooks/useGoogleTag.ts",
      "src/pages/Agendamento.tsx",
    ],
    source: "code",
  },
  {
    type: "Meta Pixel",
    id: "(configurado apenas no GTM)",
    purpose:
      "Pixel do Facebook/Instagram — disparado via GTM (browser) + Meta CAPI (server, edge function meta-capi)",
    files: [
      "src/hooks/useMetaPixel.ts (apenas dataLayer push)",
      "supabase/functions/meta-capi/index.ts (server-side)",
    ],
    source: "gtm-only",
  },
];

const DATALAYER_EVENTS = [
  // useGoogleTag – Google Ads / GA4
  { event: "whatsapp_click", origin: "useGoogleTag.trackWhatsAppClick" },
  { event: "phone_click", origin: "useGoogleTag.trackPhoneClick" },
  { event: "google_ads_conversion", origin: "useGoogleTag (várias conversões AW-*)" },
  { event: "form_submitted", origin: "useGoogleTag.trackFormSubmitConversion" },
  { event: "begin_checkout", origin: "useGoogleTag.trackScheduleStart" },
  { event: "purchase", origin: "useGoogleTag.trackScheduleComplete" },
  { event: "contact", origin: "useGoogleTag.trackContact" },
  { event: "generate_lead", origin: "useGoogleTag.trackLead" },
  { event: "cta_click", origin: "useGoogleTag.trackCTAClick" },
  { event: "lp_form_start", origin: "useGoogleTag.trackFormStart (page='landing')" },
  { event: "modal_form_start", origin: "useGoogleTag.trackFormStart (page='modal')" },
  { event: "lp_step_completed", origin: "useGoogleTag.trackStepCompleted (landing)" },
  { event: "modal_step_completed", origin: "useGoogleTag.trackStepCompleted (modal)" },
  { event: "lp_appointment_success", origin: "useGoogleTag.trackAppointmentSuccess (landing)" },
  { event: "modal_appointment_success", origin: "useGoogleTag.trackAppointmentSuccess (modal)" },
  { event: "lp_appointment_error", origin: "useGoogleTag.trackAppointmentError (landing)" },
  { event: "modal_appointment_error", origin: "useGoogleTag.trackAppointmentError (modal)" },

  // Agendamento.tsx – ad-hoc pushes
  { event: "view_scheduling_page", origin: "Agendamento.tsx (mount)" },
  { event: "lp_step_view", origin: "Agendamento.tsx (mudança de step)" },
  { event: "lead_created", origin: "Agendamento.tsx (após criar lead no step 1)" },
  { event: "lp_appointment_scheduled", origin: "Agendamento.tsx (confirmação final)" },

  // Obrigado.tsx
  { event: "thank_you_page_view", origin: "Obrigado.tsx (mount)" },

  // useMetaPixel
  { event: "meta_view_content", origin: "useMetaPixel.trackViewContent" },
  {
    event: "meta_lead",
    origin: "useMetaPixel.trackLead ← Agendamento.tsx + SchedulingModal.tsx",
  },
  { event: "meta_appointment_form_started", origin: "useMetaPixel.trackLead (paralelo)" },
  { event: "meta_schedule", origin: "useMetaPixel.trackSchedule" },
  { event: "meta_appointment_booked", origin: "useMetaPixel.trackSchedule (paralelo)" },
  {
    event: "meta_complete_registration",
    origin: "useMetaPixel.trackCompleteRegistration ← Agendamento.tsx + SchedulingModal.tsx",
  },
  {
    event: "meta_appointment_confirmed",
    origin: "useMetaPixel.trackCompleteRegistration (paralelo)",
  },
  { event: "meta_contact", origin: "useMetaPixel.trackContact" },
  { event: "meta_<eventName>", origin: "useMetaPixel.trackEvent (fallback dinâmico)" },
];

type RuntimeStatus = {
  gtmLoaded: boolean;
  dataLayerSize: number;
  fbqPresent: boolean;
  gtagPresent: boolean;
  detectedPixelIds: string[];
  detectionMethod: string;
};

const typeColor: Record<TrackingEntry["type"], string> = {
  "GTM": "bg-primary/10 text-primary border-primary/30",
  "GA4": "bg-accent/10 text-accent border-accent/30",
  "Google Ads": "bg-gold-500/10 text-gold-600 border-gold-500/30",
  "Meta Pixel": "bg-blue-500/10 text-blue-500 border-blue-500/30",
  "DataLayer Event": "bg-muted text-muted-foreground border-border",
};

const EXPECTED_PIXEL_CACHE_KEY = "expected_meta_pixel_id_cache";
const DEFAULT_EXPECTED_PIXEL_ID = "1003792428067622";

function detectMetaPixelIds(): { ids: string[]; method: string } {
  const w = window as any;
  const found = new Set<string>();
  const methods: string[] = [];

  try {
    const fbq = w.fbq;
    if (typeof fbq === "function" && typeof fbq.getState === "function") {
      const state = fbq.getState();
      const pixels = state?.pixels || [];
      pixels.forEach((p: any) => p?.id && found.add(String(p.id)));
      if (pixels.length) methods.push("fbq.getState()");
    }
  } catch { /* ignore */ }

  try {
    const inst = w._fbq?.instance?.pixelsByID;
    if (inst && typeof inst === "object") {
      Object.keys(inst).forEach((id) => found.add(String(id)));
      if (Object.keys(inst).length) methods.push("_fbq.instance");
    }
  } catch { /* ignore */ }

  try {
    const imgs = Array.from(document.images) as HTMLImageElement[];
    imgs.forEach((img) => {
      const src = img.src || "";
      const m = src.match(/facebook\.com\/tr.*?[?&]id=(\d+)/);
      if (m) found.add(m[1]);
    });
    if (Array.from(document.images).some((i) => i.src.includes("facebook.com/tr"))) {
      methods.push("img tr?id");
    }
  } catch { /* ignore */ }

  return {
    ids: Array.from(found),
    method: methods.length ? methods.join(", ") : "nenhum método retornou IDs",
  };
}

// ---------- CAPI logs ----------
type CapiLog = {
  id: string;
  level: string;
  message: string;
  details: any;
  created_at: string;
};

type CapiStats = {
  loading: boolean;
  loaded: boolean;
  total: number;
  success24h: number;
  error24h: number;
  success7d: number;
  error7d: number;
  lastEvent: CapiLog | null;
  lastError: CapiLog | null;
  recent: CapiLog[];
};

const EMPTY_CAPI_STATS: CapiStats = {
  loading: true,
  loaded: false,
  total: 0,
  success24h: 0,
  error24h: 0,
  success7d: 0,
  error7d: 0,
  lastEvent: null,
  lastError: null,
  recent: [],
};

const ERROR_LEVELS = new Set(["warn", "error", "critical"]);

export default function AuditoriaTracking() {
  const [expectedPixelId, setExpectedPixelId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_EXPECTED_PIXEL_ID;
    return localStorage.getItem(EXPECTED_PIXEL_CACHE_KEY) || DEFAULT_EXPECTED_PIXEL_ID;
  });
  const [pixelSource, setPixelSource] = useState<"db" | "cache" | "fallback">("cache");
  const [pixelInput, setPixelInput] = useState(expectedPixelId);
  const [savingPixel, setSavingPixel] = useState(false);

  const [runtime, setRuntime] = useState<RuntimeStatus>({
    gtmLoaded: false,
    dataLayerSize: 0,
    fbqPresent: false,
    gtagPresent: false,
    detectedPixelIds: [],
    detectionMethod: "",
  });

  const [capi, setCapi] = useState<CapiStats>(EMPTY_CAPI_STATS);

  // ---- carregar Pixel ID do banco ----
  const loadExpectedPixel = useCallback(async () => {
    const { data, error } = await supabase
      .from("site_config")
      .select("expected_meta_pixel_id")
      .eq("id", true)
      .maybeSingle();
    if (error || !data?.expected_meta_pixel_id) {
      setPixelSource("fallback");
      return;
    }
    setExpectedPixelId(data.expected_meta_pixel_id);
    setPixelInput(data.expected_meta_pixel_id);
    setPixelSource("db");
    try {
      localStorage.setItem(EXPECTED_PIXEL_CACHE_KEY, data.expected_meta_pixel_id);
    } catch { /* ignore */ }
  }, []);

  // ---- carregar logs CAPI ----
  const loadCapi = useCallback(async () => {
    setCapi((c) => ({ ...c, loading: true }));
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("system_logs")
      .select("id, level, message, details, created_at")
      .eq("source", "meta-capi")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Falha ao ler logs CAPI: " + error.message);
      setCapi({ ...EMPTY_CAPI_STATS, loading: false, loaded: true });
      return;
    }

    const rows = (data ?? []) as CapiLog[];
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let s24 = 0, e24 = 0, s7 = 0, e7 = 0;
    let lastEvent: CapiLog | null = null;
    let lastError: CapiLog | null = null;

    rows.forEach((r) => {
      const t = new Date(r.created_at).getTime();
      const isError = ERROR_LEVELS.has(r.level);
      if (now - t <= day) {
        if (isError) e24++;
        else s24++;
      }
      if (isError) e7++;
      else s7++;
      if (!lastEvent) lastEvent = r;
      if (isError && !lastError) lastError = r;
    });

    setCapi({
      loading: false,
      loaded: true,
      total: rows.length,
      success24h: s24,
      error24h: e24,
      success7d: s7,
      error7d: e7,
      lastEvent,
      lastError,
      recent: rows.slice(0, 10),
    });
  }, []);

  const runDetection = useCallback(() => {
    const w = window as any;
    const detection = detectMetaPixelIds();
    setRuntime({
      gtmLoaded: Array.isArray(w.dataLayer) && w.dataLayer.some((e: any) => e?.["gtm.start"]),
      dataLayerSize: Array.isArray(w.dataLayer) ? w.dataLayer.length : 0,
      fbqPresent: typeof w.fbq === "function",
      gtagPresent: typeof w.gtag === "function",
      detectedPixelIds: detection.ids,
      detectionMethod: detection.method,
    });
  }, []);

  useEffect(() => {
    loadExpectedPixel();
    loadCapi();
    runDetection();
    const t1 = setTimeout(runDetection, 1500);
    const t2 = setTimeout(runDetection, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loadExpectedPixel, loadCapi, runDetection]);

  const saveExpectedPixel = async () => {
    const trimmed = pixelInput.trim();
    if (!/^\d{10,20}$/.test(trimmed)) {
      toast.error("Pixel ID inválido — deve conter apenas dígitos (10-20)");
      return;
    }
    setSavingPixel(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    const { error } = await supabase
      .from("site_config")
      .update({ expected_meta_pixel_id: trimmed, updated_by: uid })
      .eq("id", true);
    setSavingPixel(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message + " (apenas admins podem alterar)");
      return;
    }
    setExpectedPixelId(trimmed);
    setPixelSource("db");
    try {
      localStorage.setItem(EXPECTED_PIXEL_CACHE_KEY, trimmed);
    } catch { /* ignore */ }
    toast.success("Pixel ID esperado atualizado e registrado em system_logs");
  };

  const pixelOnlyInGtm = TRACKING_INVENTORY.some(
    (t) => t.type === "Meta Pixel" && t.source === "gtm-only",
  );

  const pixelMatch =
    runtime.detectedPixelIds.length > 0 &&
    runtime.detectedPixelIds.includes(expectedPixelId);
  const pixelMismatch = runtime.detectedPixelIds.length > 0 && !pixelMatch;
  const pixelMissing = runtime.fbqPresent === false && runtime.detectedPixelIds.length === 0;

  const metaEventsManagerUrl = useMemo(
    () =>
      `https://business.facebook.com/events_manager2/list/pixel/${expectedPixelId}/overview`,
    [expectedPixelId],
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-foreground">
              Auditoria de Tracking
            </h1>
            <p className="text-muted-foreground mt-1">
              Mapa de IDs, labels e eventos de rastreamento — código, runtime e Meta CAPI (server).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/agendamento" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                /agendamento
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/obrigado" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                /obrigado
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="https://tagassistant.google.com/" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                GTM Preview
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={metaEventsManagerUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Meta Events Manager
              </a>
            </Button>
          </div>
        </div>

        {/* Banner de contexto /admin */}
        <Alert className="border-gold-500/50 bg-gold-500/5">
          <Info className="h-5 w-5 text-gold-600" />
          <AlertTitle className="text-gold-700">
            Você está em /admin — GTM/Pixel podem estar bloqueados nesta aba
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Por regra do projeto, o Consent Mode e o guard de admin desativam GTM e
            Meta Pixel em <code>/admin/*</code> e <code>/auth</code>. O painel
            &quot;Status em Runtime&quot; abaixo pode aparecer todo vazio mesmo com o
            tracking 100% funcional em produção. Para validar runtime real, use os
            botões acima e abra <code>/agendamento</code> ou <code>/obrigado</code> em
            outra aba (de preferência anônima e sem bloqueador).
          </AlertDescription>
        </Alert>

        {pixelOnlyInGtm && (
          <Alert className="border-gold-500/50 bg-gold-500/5">
            <ShieldAlert className="h-5 w-5 text-gold-600" />
            <AlertTitle className="text-gold-700">
              Meta Pixel configurado apenas no GTM (browser) + CAPI (server)
            </AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Não há <code className="text-xs bg-muted px-1 rounded">fbq('init', ...)</code>
              {" "}hard-coded. O canal browser depende do GTM
              (<code className="text-xs">GTM-K3C2NNF6</code>) e o canal servidor da
              edge function <code className="text-xs">meta-capi</code>. Confira a
              seção Meta CAPI abaixo para validar o canal server-side.
            </AlertDescription>
          </Alert>
        )}

        {/* Verificação de Meta Pixel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Verificação do Meta Pixel
                </CardTitle>
                <CardDescription>
                  Compara o Pixel ID detectado em runtime com o esperado (fonte: banco).
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={runDetection}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-checar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {pixelMatch && (
              <Alert className="border-emerald-500/50 bg-emerald-500/5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <AlertTitle className="text-emerald-600">Pixel ID confere</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  O Pixel <code className="text-xs">{expectedPixelId}</code> foi detectado
                  em runtime via <code className="text-xs">{runtime.detectionMethod}</code>.
                </AlertDescription>
              </Alert>
            )}

            {pixelMismatch && (
              <Alert className="border-destructive/50 bg-destructive/5">
                <XCircle className="h-5 w-5 text-destructive" />
                <AlertTitle className="text-destructive">
                  Divergência detectada no Meta Pixel
                </AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Esperado: <code className="text-xs">{expectedPixelId}</code>
                  <br />
                  Detectado em runtime:{" "}
                  {runtime.detectedPixelIds.map((id) => (
                    <code key={id} className="text-xs bg-muted px-1 rounded mr-1">
                      {id}
                    </code>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {pixelMissing && (
              <Alert className="border-gold-500/50 bg-gold-500/5">
                <AlertTriangle className="h-5 w-5 text-gold-600" />
                <AlertTitle className="text-gold-700">Meta Pixel não detectado</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Esperado nesta tela — GTM/Pixel estão bloqueados em /admin. Abra
                  <code className="text-xs mx-1">/agendamento</code> em aba anônima
                  para validar de verdade.
                </AlertDescription>
              </Alert>
            )}

            {!pixelMatch && !pixelMismatch && !pixelMissing && (
              <Alert>
                <Activity className="h-5 w-5" />
                <AlertTitle>Aguardando carregamento do Pixel...</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Re-executado automaticamente após 1.5s e 4s.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Pixel(s) detectado(s)
                </div>
                {runtime.detectedPixelIds.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">nenhum</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {runtime.detectedPixelIds.map((id) => (
                      <code
                        key={id}
                        className={`text-xs px-2 py-1 rounded ${
                          id === expectedPixelId
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {id}
                      </code>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  método: {runtime.detectionMethod}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="expected-pixel" className="text-xs">
                    Pixel ID esperado (compartilhado com a equipe)
                  </Label>
                  <Badge
                    variant="outline"
                    className={
                      pixelSource === "db"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : pixelSource === "cache"
                        ? "bg-muted text-muted-foreground"
                        : "bg-gold-500/10 text-gold-600 border-gold-500/30"
                    }
                  >
                    {pixelSource === "db"
                      ? "banco"
                      : pixelSource === "cache"
                      ? "cache"
                      : "fallback"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="expected-pixel"
                    value={pixelInput}
                    onChange={(e) => setPixelInput(e.target.value)}
                    placeholder="ex: 1003792428067622"
                    className="font-mono text-sm"
                    disabled={savingPixel}
                  />
                  <Button onClick={saveExpectedPixel} size="sm" disabled={savingPixel}>
                    {savingPixel ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Persistido em <code>site_config.expected_meta_pixel_id</code>. Toda
                  alteração é registrada automaticamente em <code>system_logs</code>{" "}
                  (source <code>admin/auditoria-tracking</code>).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meta CAPI (server) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  Meta CAPI (server-side)
                </CardTitle>
                <CardDescription>
                  Últimos envios da edge function <code>meta-capi</code> lidos de{" "}
                  <code>system_logs</code>.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadCapi} disabled={capi.loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${capi.loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {capi.loaded && capi.total === 0 && (
              <Alert>
                <Info className="h-5 w-5" />
                <AlertTitle>Nenhum log CAPI encontrado ainda</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Após o próximo evento server-side (Lead, Schedule, CompleteRegistration
                  etc.), ele aparecerá aqui. Erros já são logados; sucessos passaram a
                  ser logados a partir desta versão.
                </AlertDescription>
              </Alert>
            )}

            {capi.total > 0 && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label="Sucesso · 24h" value={capi.success24h} tone="ok" />
                  <StatCard label="Erro · 24h" value={capi.error24h} tone={capi.error24h ? "err" : "muted"} />
                  <StatCard label="Sucesso · 7d" value={capi.success7d} tone="ok" />
                  <StatCard label="Erro · 7d" value={capi.error7d} tone={capi.error7d ? "err" : "muted"} />
                </div>

                {capi.lastEvent && (
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <div className="text-xs text-muted-foreground">Último evento</div>
                    <div className="mt-1">
                      <Badge variant="outline" className="mr-2">
                        {capi.lastEvent.level}
                      </Badge>
                      <code className="text-xs">{capi.lastEvent.message}</code>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(capi.lastEvent.created_at).toLocaleString("pt-BR")}
                      {capi.lastEvent.details?.event_id && (
                        <>
                          {" · event_id: "}
                          <code>{capi.lastEvent.details.event_id}</code>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {capi.lastError && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                    <div className="text-xs text-destructive">Último erro</div>
                    <div className="mt-1">
                      <Badge variant="outline" className="mr-2 bg-destructive/10 text-destructive border-destructive/30">
                        {capi.lastError.level}
                      </Badge>
                      <code className="text-xs">{capi.lastError.message}</code>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(capi.lastError.created_at).toLocaleString("pt-BR")}
                      {capi.lastError.details?.fbtrace_id && (
                        <>
                          {" · fbtrace: "}
                          <code>{capi.lastError.details.fbtrace_id}</code>
                        </>
                      )}
                    </div>
                    {capi.lastError.details?.meta_error && (
                      <pre className="text-[10px] mt-2 bg-background/50 border border-border rounded p-2 overflow-x-auto">
                        {JSON.stringify(capi.lastError.details.meta_error, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                <div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Últimos {capi.recent.length} envios
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quando</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>event_id</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {capi.recent.map((r) => {
                        const isErr = ERROR_LEVELS.has(r.level);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(r.created_at).toLocaleString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  isErr
                                    ? "bg-destructive/10 text-destructive border-destructive/30"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                }
                              >
                                {r.level}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{r.message}</TableCell>
                            <TableCell>
                              <code className="text-[10px]">
                                {r.details?.event_id ?? "—"}
                              </code>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Runtime status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Status em Runtime
            </CardTitle>
            <CardDescription>
              O que está carregado nesta sessão do navegador (lembre: /admin bloqueia GTM/Pixel).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <RuntimeBadge label="GTM carregado" ok={runtime.gtmLoaded} />
              <RuntimeBadge label="gtag() (Google Ads)" ok={runtime.gtagPresent} />
              <RuntimeBadge label="fbq() (Meta)" ok={runtime.fbqPresent} />
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">DataLayer</div>
                <div className="text-2xl font-bold text-foreground">
                  {runtime.dataLayerSize}
                </div>
                <div className="text-xs text-muted-foreground">eventos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventário de IDs e Labels */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Inventário de IDs e Labels
            </CardTitle>
            <CardDescription>
              Tudo que aparece hard-coded no código-fonte (atualização manual).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TRACKING_INVENTORY.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Badge variant="outline" className={typeColor[entry.type]}>
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {entry.id}
                      </code>
                    </TableCell>
                    <TableCell>
                      {entry.label ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {entry.label}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {entry.purpose}
                    </TableCell>
                    <TableCell>
                      {entry.source === "gtm-only" ? (
                        <Badge variant="outline" className="bg-gold-500/10 text-gold-600 border-gold-500/30">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Apenas GTM
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Código
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Arquivos por entrada */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Arquivos por entrada
            </CardTitle>
            <CardDescription>
              Onde cada ID/label aparece no repositório.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {TRACKING_INVENTORY.map((entry, i) => (
              <div key={i} className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={typeColor[entry.type]}>
                    {entry.type}
                  </Badge>
                  <code className="text-xs">{entry.id}</code>
                  {entry.label && (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <code className="text-xs">{entry.label}</code>
                    </>
                  )}
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {entry.files.map((f) => (
                    <li key={f}>
                      <code>{f}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Eventos do DataLayer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Eventos do DataLayer
            </CardTitle>
            <CardDescription>
              Eventos que o código dispara para o GTM consumir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Origem no código</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DATALAYER_EVENTS.map((e) => (
                  <TableRow key={e.event}>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {e.event}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.origin}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function RuntimeBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        {ok ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-foreground">Ativo</span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4 text-gold-600" />
            <span className="text-sm font-medium text-foreground">Ausente</span>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "err" | "muted";
}) {
  const color =
    tone === "ok"
      ? "text-emerald-600"
      : tone === "err"
      ? "text-destructive"
      : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
