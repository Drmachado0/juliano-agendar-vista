import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, RefreshCw, ExternalLink, Loader2, Smartphone, Wifi, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ZapiStatus {
  success: boolean;
  configured: boolean;
  connected?: boolean;
  smartphoneConnected?: boolean;
  status?: number;
  instance_id_masked?: string | null;
  base_url?: string;
  error?: string;
  envs?: Record<string, boolean>;
  raw?: any;
}

export default function ZapiStatusCard() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ZapiStatus | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("zapi-status");
      if (error) {
        toast.error("Erro ao consultar status: " + error.message);
        setStatus({ success: false, configured: true, error: error.message });
      } else {
        setStatus(data as ZapiStatus);
        setLastCheck(new Date());
      }
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // auto-refresh a cada 60s
    const id = setInterval(carregar, 60_000);
    return () => clearInterval(id);
  }, []);

  const connected = status?.connected === true;
  const phoneConnected = status?.smartphoneConnected === true;

  return (
    <div className="space-y-6">
      {/* Card de Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Status da Conexão Z-API
              </CardTitle>
              <CardDescription>
                Monitoramento em tempo real da instância de WhatsApp (atualiza a cada 60s)
              </CardDescription>
            </div>
            <Button onClick={carregar} disabled={loading} size="sm" variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Atualizar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status && loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando Z-API…
            </div>
          )}

          {status && !status.configured && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Z-API não configurada</p>
                <p className="text-sm mt-1">{status.error}</p>
                {status.envs && (
                  <ul className="text-xs mt-2 space-y-0.5">
                    {Object.entries(status.envs).map(([k, v]) => (
                      <li key={k} className="flex items-center gap-2">
                        {v ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                        <code>{k}</code>
                      </li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          {status?.configured && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Wifi className="h-4 w-4" /> Instância
                    </div>
                    {connected ? (
                      <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Conectada
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" /> Desconectada
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A instância da Z-API está {connected ? "online e pronta para enviar mensagens" : "offline ou inativa"}.
                  </p>
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Smartphone className="h-4 w-4" /> Celular
                    </div>
                    {phoneConnected ? (
                      <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Pareado
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" /> Sem celular
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {phoneConnected
                      ? "O WhatsApp do celular está pareado e sincronizado."
                      : "Abra o WhatsApp no celular para restaurar a conexão."}
                  </p>
                </div>
              </div>

              {!connected && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    A conexão (pareamento / leitura de QR Code) é feita diretamente no painel da Z-API.
                    Acesse <strong>Instâncias Web → Conectar</strong> no painel da Z-API.
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                <span><strong>Base URL:</strong> {status.base_url}</span>
                <span><strong>Instância:</strong> {status.instance_id_masked}</span>
                <span><strong>HTTP:</strong> {status.status}</span>
                {lastCheck && <span><strong>Última verificação:</strong> {lastCheck.toLocaleTimeString()}</span>}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Card de Configurações */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações da Z-API</CardTitle>
          <CardDescription>
            As credenciais são armazenadas como secrets do backend e nunca expostas no navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <SecretRow name="ZAPI_BASE_URL" ok={status?.envs?.ZAPI_BASE_URL ?? true} hint="Padrão: https://api.z-api.io" />
            <SecretRow name="ZAPI_INSTANCE" ok={status?.envs?.ZAPI_INSTANCE ?? status?.configured ?? false} hint="ID da instância (painel Z-API)" />
            <SecretRow name="ZAPI_TOKEN" ok={status?.envs?.ZAPI_TOKEN ?? status?.configured ?? false} hint="Token da instância" />
            <SecretRow name="ZAPI_CLIENT_TOKEN" ok={status?.envs?.ZAPI_CLIENT_TOKEN ?? status?.configured ?? false} hint="Account Security (Client-Token)" />
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              Para atualizar as credenciais, edite os secrets no <strong>Lovable Cloud → Project Settings → Secrets</strong>.
              O envio de mensagens, verificação de números e este monitoramento usam esses mesmos secrets.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="https://app.z-api.io/" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir painel da Z-API
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="https://developer.z-api.io/" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" /> Documentação
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecretRow({ name, ok, hint }: { name: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-start gap-2 rounded border p-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">
        <code className="text-xs font-mono">{name}</code>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
