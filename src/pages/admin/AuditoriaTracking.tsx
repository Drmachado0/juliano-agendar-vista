import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
} from "lucide-react";

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
      "src/pages/Agendar.tsx",
      "src/pages/AgendarConsulta.tsx",
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
      "src/pages/AgendarConsulta.tsx",
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
};

const typeColor: Record<TrackingEntry["type"], string> = {
  "GTM": "bg-primary/10 text-primary border-primary/30",
  "GA4": "bg-accent/10 text-accent border-accent/30",
  "Google Ads": "bg-gold-500/10 text-gold-600 border-gold-500/30",
  "Meta Pixel": "bg-blue-500/10 text-blue-500 border-blue-500/30",
  "DataLayer Event": "bg-muted text-muted-foreground border-border",
};

export default function AuditoriaTracking() {
  const [runtime, setRuntime] = useState<RuntimeStatus>({
    gtmLoaded: false,
    dataLayerSize: 0,
    fbqPresent: false,
    gtagPresent: false,
  });

  useEffect(() => {
    const w = window as any;
    setRuntime({
      gtmLoaded: Array.isArray(w.dataLayer) && w.dataLayer.some((e: any) => e?.["gtm.start"]),
      dataLayerSize: Array.isArray(w.dataLayer) ? w.dataLayer.length : 0,
      fbqPresent: typeof w.fbq === "function",
      gtagPresent: typeof w.gtag === "function",
    });
  }, []);

  const pixelOnlyInGtm = TRACKING_INVENTORY.some(
    (t) => t.type === "Meta Pixel" && t.source === "gtm-only"
  );

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
