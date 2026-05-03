import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

/**
 * AUDITORIA DE TRACKING
 *
 * Esta tela escaneia o que está hard-coded no código-fonte do projeto
 * (IDs e labels) e cruza com o que está realmente carregado em runtime
 * (GTM, gtag, fbq, dataLayer). Aponta divergências e riscos.
 *
 * Os dados estáticos abaixo são gerados a partir de varredura no código.
 * Sempre que novos eventos forem adicionados, atualize este array.
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
    purpose: "Pixel do Facebook/Instagram — disparado via GTM, sem fbq() no código",
    files: ["src/hooks/useMetaPixel.ts (apenas dataLayer push)"],
    source: "gtm-only",
  },
];

const DATALAYER_EVENTS = [
  { event: "whatsapp_click", origin: "useGoogleTag.trackWhatsAppClick" },
  { event: "phone_click", origin: "useGoogleTag.trackPhoneClick" },
  { event: "google_ads_conversion", origin: "useGoogleTag (várias)" },
  { event: "form_submitted", origin: "useGoogleTag.trackFormSubmitConversion" },
  { event: "begin_checkout", origin: "useGoogleTag.trackScheduleStart" },
  { event: "purchase", origin: "useGoogleTag.trackScheduleComplete" },
  { event: "contact", origin: "useGoogleTag.trackContact" },
  { event: "generate_lead", origin: "useGoogleTag.trackLead" },
  { event: "cta_click", origin: "useGoogleTag.trackCTAClick" },
  { event: "meta_view_content", origin: "useMetaPixel.trackViewContent" },
  { event: "meta_lead", origin: "useMetaPixel.trackLead" },
  { event: "meta_schedule", origin: "useMetaPixel.trackSchedule" },
  { event: "meta_complete_registration", origin: "useMetaPixel.trackCompleteRegistration" },
  { event: "meta_contact", origin: "useMetaPixel.trackContact" },
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

const EXPECTED_PIXEL_STORAGE_KEY = "expected_meta_pixel_id";
const DEFAULT_EXPECTED_PIXEL_ID = "1003792428067622";

/**
 * Detecta Pixel IDs ativos em runtime usando 3 estratégias:
 * 1. fbq.getState().pixels — API interna do fbq quando carregado
 * 2. window._fbq.instance.pixelsByID — fallback estado interno
 * 3. Parsing de scripts/imgs do facebook (fbevents.js / tr?id=...)
 */
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
  } catch {
    // ignore
  }

  try {
    const inst = w._fbq?.instance?.pixelsByID;
    if (inst && typeof inst === "object") {
      Object.keys(inst).forEach((id) => found.add(String(id)));
      if (Object.keys(inst).length) methods.push("_fbq.instance");
    }
  } catch {
    // ignore
  }

  // Fallback: ler imagens tr?id=... e scripts fbevents
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
  } catch {
    // ignore
  }

  return {
    ids: Array.from(found),
    method: methods.length ? methods.join(", ") : "nenhum método retornou IDs",
  };
}

export default function AuditoriaTracking() {
  const [expectedPixelId, setExpectedPixelId] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_EXPECTED_PIXEL_ID;
    return localStorage.getItem(EXPECTED_PIXEL_STORAGE_KEY) || DEFAULT_EXPECTED_PIXEL_ID;
  });
  const [pixelInput, setPixelInput] = useState(expectedPixelId);
  const [runtime, setRuntime] = useState<RuntimeStatus>({
    gtmLoaded: false,
    dataLayerSize: 0,
    fbqPresent: false,
    gtagPresent: false,
    detectedPixelIds: [],
    detectionMethod: "",
  });

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
    runDetection();
    // Re-checar após GTM/Pixel carregarem (assíncronos)
    const t1 = setTimeout(runDetection, 1500);
    const t2 = setTimeout(runDetection, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [runDetection]);

  const saveExpectedPixel = () => {
    const trimmed = pixelInput.trim();
    if (!/^\d{10,20}$/.test(trimmed)) {
      toast.error("Pixel ID inválido — deve conter apenas dígitos (10-20)");
      return;
    }
    localStorage.setItem(EXPECTED_PIXEL_STORAGE_KEY, trimmed);
    setExpectedPixelId(trimmed);
    toast.success("Pixel ID esperado atualizado");
  };

  const pixelOnlyInGtm = TRACKING_INVENTORY.some(
    (t) => t.type === "Meta Pixel" && t.source === "gtm-only"
  );

  const pixelMatch =
    runtime.detectedPixelIds.length > 0 &&
    runtime.detectedPixelIds.includes(expectedPixelId);
  const pixelMismatch =
    runtime.detectedPixelIds.length > 0 && !pixelMatch;
  const pixelMissing =
    runtime.fbqPresent === false && runtime.detectedPixelIds.length === 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-foreground">
            Auditoria de Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Mapa de IDs, labels e eventos de rastreamento usados no código e em runtime.
          </p>
        </div>

        {/* Alertas de risco */}
        {pixelOnlyInGtm && (
          <Alert className="border-gold-500/50 bg-gold-500/5">
            <ShieldAlert className="h-5 w-5 text-gold-600" />
            <AlertTitle className="text-gold-700">
              Meta Pixel configurado apenas no GTM
            </AlertTitle>
            <AlertDescription className="text-muted-foreground">
              O Pixel do Meta não está hard-coded no código (não há{" "}
              <code className="text-xs bg-muted px-1 rounded">fbq('init', ...)</code>).
              Toda a configuração depende do painel do GTM (
              <code className="text-xs">GTM-K3C2NNF6</code>). Risco de divergência:
              uma alteração de Pixel ID no GTM não deixa rastro no repositório, e
              uma falha de carregamento do GTM derruba 100% do tracking do Meta.
              Recomendado: documentar o Pixel ID ativo neste painel e validar
              periodicamente em runtime.
            </AlertDescription>
          </Alert>
        )}

        {/* Verificação automática de Meta Pixel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Verificação do Meta Pixel
                </CardTitle>
                <CardDescription>
                  Compara o Pixel ID detectado em runtime com o esperado.
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
                <AlertTitle className="text-emerald-600">
                  Pixel ID confere
                </AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  O Pixel <code className="text-xs">{expectedPixelId}</code> foi
                  detectado corretamente em runtime via{" "}
                  <code className="text-xs">{runtime.detectionMethod}</code>.
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
                  <br />
                  Verifique se a tag do Meta Pixel no GTM (
                  <code className="text-xs">GTM-K3C2NNF6</code>) está com o ID
                  correto e foi publicada.
                </AlertDescription>
              </Alert>
            )}

            {pixelMissing && (
              <Alert className="border-gold-500/50 bg-gold-500/5">
                <AlertTriangle className="h-5 w-5 text-gold-600" />
                <AlertTitle className="text-gold-700">
                  Meta Pixel não detectado
                </AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Nenhum Pixel ID foi encontrado em runtime. Causas possíveis:
                  bloqueador de anúncios ativo, tag do Pixel não publicada no
                  GTM, ou GTM bloqueado pela rede. Reabra esta página em uma aba
                  anônima sem extensões para confirmar.
                </AlertDescription>
              </Alert>
            )}

            {!pixelMatch && !pixelMismatch && !pixelMissing && (
              <Alert>
                <Activity className="h-5 w-5" />
                <AlertTitle>Aguardando carregamento do Pixel...</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  A detecção é re-executada automaticamente após 1.5s e 4s.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground mb-1">
                  Pixel(s) detectado(s)
                </div>
                {runtime.detectedPixelIds.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">
                    nenhum
                  </div>
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
                <Label htmlFor="expected-pixel" className="text-xs">
                  Pixel ID esperado (configurado no GTM)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="expected-pixel"
                    value={pixelInput}
                    onChange={(e) => setPixelInput(e.target.value)}
                    placeholder="ex: 1003792428067622"
                    className="font-mono text-sm"
                  />
                  <Button onClick={saveExpectedPixel} size="sm">
                    Salvar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Salvo localmente no navegador. Atualize sempre que mudar o
                  Pixel ID no GTM.
                </p>
              </div>
            </div>
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
              O que está realmente carregado nesta sessão do navegador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <RuntimeBadge label="GTM carregado" ok={runtime.gtmLoaded} />
              <RuntimeBadge label="gtag()" ok={runtime.gtagPresent} optional />
              <RuntimeBadge label="fbq() (Meta)" ok={runtime.fbqPresent} />
              <div className="rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground">DataLayer</div>
                <div className="text-2xl font-bold text-foreground">
                  {runtime.dataLayerSize}
                </div>
                <div className="text-xs text-muted-foreground">eventos</div>
              </div>
            </div>
            {!runtime.fbqPresent && (
              <p className="text-xs text-muted-foreground mt-4">
                ⚠️ <code>fbq()</code> não está disponível nesta sessão. Se o Pixel
                deveria estar ativo, verifique se a tag do Meta Pixel está
                publicada no GTM e se não há bloqueador de anúncios ativo.
              </p>
            )}
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
              Tudo que aparece hard-coded no código-fonte.
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

        {/* Arquivos referenciados */}
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

function RuntimeBadge({
  label,
  ok,
  optional,
}: {
  label: string;
  ok: boolean;
  optional?: boolean;
}) {
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
            <AlertTriangle
              className={`h-4 w-4 ${optional ? "text-muted-foreground" : "text-gold-600"}`}
            />
            <span className="text-sm font-medium text-foreground">
              {optional ? "Não usado" : "Ausente"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
