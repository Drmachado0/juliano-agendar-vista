import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Smartphone,
  QrCode,
  Settings2
} from "lucide-react";
import { useEvolutionStatus } from "@/hooks/useEvolutionStatus";
import { cn } from "@/lib/utils";

const ConfiguracoesEvolution = () => {
  const { status, loading, lastChecked, refresh } = useEvolutionStatus(true, 30000);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const getStatusDisplay = () => {
    if (loading && !status) {
      return {
        icon: RefreshCw,
        iconClass: "animate-spin text-muted-foreground",
        label: "Verificando...",
        variant: "secondary" as const,
        description: "Aguarde enquanto verificamos o status da conexão.",
      };
    }

    if (!status) {
      return {
        icon: AlertTriangle,
        iconClass: "text-yellow-500",
        label: "Status desconhecido",
        variant: "secondary" as const,
        description: "Não foi possível verificar o status da conexão.",
      };
    }

    if (status.connected) {
      return {
        icon: CheckCircle2,
        iconClass: "text-green-500",
        label: "Conectado",
        variant: "default" as const,
        description: "A instância do WhatsApp está conectada e pronta para enviar mensagens.",
      };
    }

    const stateInfo: Record<string, { label: string; description: string }> = {
      close: {
        label: "Desconectado",
        description: "A instância do WhatsApp está desconectada. É necessário escanear o QR Code para reconectar.",
      },
      connecting: {
        label: "Conectando...",
        description: "A instância está tentando se conectar. Aguarde alguns segundos.",
      },
      timeout: {
        label: "Sem resposta",
        description: "O servidor da Evolution API não respondeu a tempo. Verifique se o servidor está online.",
      },
      not_configured: {
        label: "Não configurado",
        description: "As variáveis de ambiente da Evolution API não estão configuradas corretamente.",
      },
      error: {
        label: "Erro",
        description: status.error || "Ocorreu um erro ao verificar o status da conexão.",
      },
    };

    const info = stateInfo[status.state] || stateInfo.error;

    return {
      icon: XCircle,
      iconClass: "text-destructive",
      label: info.label,
      variant: "destructive" as const,
      description: info.description,
    };
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações da Evolution API</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a conexão com o WhatsApp via Evolution API
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  Status da Conexão
                </CardTitle>
                <CardDescription>
                  Verifique se a instância do WhatsApp está conectada
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", (isRefreshing || loading) && "animate-spin")} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Display */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className={cn("p-3 rounded-full bg-background")}>
                <StatusIcon className={cn("h-8 w-8", statusDisplay.iconClass)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{statusDisplay.label}</span>
                  <Badge variant={statusDisplay.variant}>
                    {status?.instanceName || "N/A"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{statusDisplay.description}</p>
              </div>
            </div>

            {/* Last Checked */}
            {lastChecked && (
              <p className="text-xs text-muted-foreground text-right">
                Última verificação: {lastChecked.toLocaleString("pt-BR")}
              </p>
            )}

            {/* Error Details */}
            {status?.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Detalhes do erro</AlertTitle>
                <AlertDescription>{status.error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Como Reconectar o WhatsApp
            </CardTitle>
            <CardDescription>
              Siga as instruções abaixo caso a instância esteja desconectada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Acesse o painel da Evolution API</h4>
                  <p className="text-sm text-muted-foreground">
                    Abra o painel de administração da Evolution API no link abaixo:
                  </p>
                  <Button variant="link" className="px-0 h-auto" asChild>
                    <a 
                      href="https://juliano-evolution.cloudfy.live" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      juliano-evolution.cloudfy.live
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Selecione a instância</h4>
                  <p className="text-sm text-muted-foreground">
                    Na lista de instâncias, clique na instância <Badge variant="outline">{status?.instanceName || "Atendente"}</Badge> para abrir as opções.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Gere um novo QR Code</h4>
                  <p className="text-sm text-muted-foreground">
                    Clique no botão "Conectar" ou "QR Code" para gerar um novo código de conexão.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-medium">Escaneie com o WhatsApp</h4>
                  <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <Smartphone className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      No seu celular, abra o WhatsApp → Menu (⋮) → Dispositivos conectados → Conectar dispositivo → Escaneie o QR Code exibido na tela.
                    </span>
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <h4 className="font-medium">Verifique a conexão</h4>
                  <p className="text-sm text-muted-foreground">
                    Após escanear, aguarde alguns segundos e clique em "Atualizar" nesta página para verificar se a conexão foi estabelecida.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Dicas Importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Mantenha o celular conectado à internet para que o WhatsApp funcione corretamente.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>O WhatsApp pode desconectar automaticamente após alguns dias de inatividade. Verifique periodicamente.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Se a conexão falhar repetidamente, tente desconectar o dispositivo no WhatsApp e reconectar.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Evite usar o mesmo número em múltiplas instâncias da Evolution API.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ConfiguracoesEvolution;
