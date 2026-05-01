import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Smartphone,
  QrCode,
  Settings2,
  RotateCcw,
  Plug,
  Zap,
  PowerOff,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  ServerCog,
  TestTube2,
  Save,
  Loader2,
  Info,
} from "lucide-react";
import { useEvolutionStatus } from "@/hooks/useEvolutionStatus";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ConfiguracoesEvolution = () => {
  const { 
    status, 
    loading, 
    actionLoading,
    lastChecked, 
    refresh,
    reiniciar,
    conectar,
    reconectar,
    desconectar
  } = useEvolutionStatus(true, 30000);
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Configuração da instância (somente leitura, mascarada)
  type EvoConfig = {
    baseUrl: string;
    instance: string;
    tokenMasked: string;
    tokenLength: number;
    configured: boolean;
  };
  const [config, setConfig] = useState<EvoConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testingCreds, setTestingCreds] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Edição inline da configuração
  const [editBaseUrl, setEditBaseUrl] = useState("");
  const [editInstance, setEditInstance] = useState("");
  const [editToken, setEditToken] = useState("");
  const [savingCfg, setSavingCfg] = useState(false);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-config", {
        body: { action: "read" },
      });
      if (error) throw error;
      const cfg = data as EvoConfig;
      setConfig(cfg);
      setEditBaseUrl(cfg.baseUrl || "");
      setEditInstance(cfg.instance || "");
      setEditToken("");
    } catch (err: any) {
      toast.error("Erro ao carregar configuração: " + (err.message || "desconhecido"));
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const hasChanges =
    (editBaseUrl || "").trim() !== (config?.baseUrl || "").trim() ||
    (editInstance || "").trim() !== (config?.instance || "").trim() ||
    (editToken || "").trim().length > 0;

  const handleSaveConfig = async () => {
    if (!hasChanges) return;

    const url = editBaseUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      toast.error("BASE URL precisa começar com http:// ou https://");
      return;
    }
    if (!editInstance.trim()) {
      toast.error("Instância não pode ser vazia");
      return;
    }
    if (editToken.trim().length > 0 && editToken.trim().length < 10) {
      toast.error("API Key muito curta (mínimo 10 caracteres)");
      return;
    }

    setSavingCfg(true);
    try {
      const payload: Record<string, string> = {
        action: "update",
        base_url: url,
        instance: editInstance.trim(),
      };
      if (editToken.trim().length > 0) payload.api_token = editToken.trim();

      const { data, error } = await supabase.functions.invoke("evolution-config", { body: payload });
      if (error) throw error;
      const r = data as EvoConfig & { success?: boolean };
      setConfig(r);
      setEditToken("");
      toast.success("Configuração salva com sucesso!");
      // Auto-testa após salvar
      setTimeout(() => handleTestCreds(), 200);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err.message || "desconhecido"));
    } finally {
      setSavingCfg(false);
    }
  };

  const handleTestCreds = async () => {
    setTestingCreds(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("evolution-config", {
        body: { action: "test" },
      });
      if (error) throw error;
      const r = data as { ok: boolean; state?: string; connected?: boolean; error?: string };
      if (r.ok) {
        setTestResult({
          ok: true,
          msg: r.connected
            ? `Credenciais válidas — instância conectada (state: ${r.state}).`
            : `Credenciais válidas, mas instância está "${r.state}". Use "Forçar Conexão" para escanear o QR Code.`,
        });
        toast.success("Credenciais válidas!");
      } else {
        setTestResult({ ok: false, msg: r.error || "Falha no teste" });
        toast.error("Credenciais inválidas: " + (r.error || ""));
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || "Erro" });
      toast.error("Erro ao testar credenciais");
    } finally {
      setTestingCreds(false);
    }
  };

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const handleReiniciar = async () => {
    toast.loading("Reiniciando instância...", { id: "restart" });
    const result = await reiniciar();
    toast.dismiss("restart");
    
    if (result.success && result.connected) {
      toast.success("Instância reiniciada e conectada!");
    } else if (result.success) {
      toast.info("Instância reiniciada. Aguarde a conexão ou escaneie o QR Code.");
    } else {
      toast.error(result.error || "Erro ao reiniciar instância");
    }
  };

  const handleConectar = async () => {
    toast.loading("Forçando conexão...", { id: "connect" });
    const result = await conectar();
    toast.dismiss("connect");
    
    if (result.success && result.connected) {
      toast.success("Conectado com sucesso!");
    } else if (result.success) {
      toast.info("Comando enviado. Se necessário, escaneie o QR Code no painel.");
    } else {
      toast.error(result.error || "Erro ao conectar");
    }
  };

  const handleReconectar = async () => {
    toast.loading("Executando reconexão completa...", { id: "reconnect" });
    const result = await reconectar();
    toast.dismiss("reconnect");
    
    if (result.success && result.connected) {
      toast.success("Reconectado com sucesso!");
    } else if (result.success) {
      toast.info("Reconexão parcial. Pode ser necessário escanear o QR Code.");
    } else {
      toast.error(result.error || "Falha na reconexão");
    }
  };

  const handleDesconectar = async () => {
    toast.loading("Desconectando WhatsApp...", { id: "logout" });
    const result = await desconectar();
    toast.dismiss("logout");

    if (result.success) {
      toast.success("WhatsApp desconectado. A instância está offline.");
    } else {
      toast.error(result.error || "Erro ao desconectar");
    }
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
  const isDisconnected = status && !status.connected;

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

        {/* Configuração da Instância (novo card) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ServerCog className="h-5 w-5" />
                  Configuração da Instância
                </CardTitle>
                <CardDescription>
                  Veja e confira as credenciais atualmente em uso pelo backend
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchConfig} disabled={loadingConfig}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", loadingConfig && "animate-spin")} />
                  Recarregar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTestCreds}
                  disabled={testingCreds || !config?.configured}
                >
                  <TestTube2 className={cn("h-4 w-4 mr-2", testingCreds && "animate-spin")} />
                  Testar credenciais
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Base URL */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Base URL
              </Label>
              <div className="flex gap-2">
                <Input
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  placeholder="https://sua-evolution.exemplo.com"
                  className="font-mono text-sm"
                  disabled={savingCfg}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(config?.baseUrl || "", "Base URL")}
                  disabled={!config?.baseUrl}
                  title="Copiar valor atual"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Instância */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Instância
              </Label>
              <div className="flex gap-2">
                <Input
                  value={editInstance}
                  onChange={(e) => setEditInstance(e.target.value)}
                  placeholder="nome-da-instancia"
                  className="font-mono text-sm"
                  disabled={savingCfg}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(config?.instance || "", "Nome da instância")}
                  disabled={!config?.instance}
                  title="Copiar valor atual"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* API Key (editável) */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5" />
                API Key
                {config?.tokenLength ? (
                  <Badge variant="secondary" className="text-[10px]">
                    atual: {config.tokenLength} chars
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">não configurada</Badge>
                )}
              </Label>
              <div className="flex gap-2">
                <Input
                  type={showToken ? "text" : "password"}
                  value={editToken}
                  onChange={(e) => setEditToken(e.target.value)}
                  placeholder={config?.tokenMasked ? `Atual: ${config.tokenMasked} (deixe vazio para manter)` : "Cole a API key da Evolution"}
                  className="font-mono text-sm"
                  disabled={savingCfg}
                  autoComplete="off"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowToken((v) => !v)}
                  title={showToken ? "Ocultar" : "Mostrar"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Por segurança o token é armazenado criptografado e nunca exibido completo. Deixe o campo
                vazio se quiser manter o token atual.
              </p>
            </div>

            {/* Botão Salvar */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                {hasChanges ? "Há alterações não salvas." : "Sem alterações pendentes."}
              </p>
              <Button onClick={handleSaveConfig} disabled={!hasChanges || savingCfg} className="gap-2">
                {savingCfg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar alterações
              </Button>
            </div>

            {/* Resultado do teste */}
            {testResult && (
              <Alert variant={testResult.ok ? "default" : "destructive"}>
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>{testResult.ok ? "Credenciais OK" : "Credenciais com problema"}</AlertTitle>
                <AlertDescription>{testResult.msg}</AlertDescription>
              </Alert>
            )}

            {/* Aviso */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Como funciona</AlertTitle>
              <AlertDescription className="text-sm">
                As credenciais ficam armazenadas com segurança no backend (token criptografado em repouso).
                Alterações passam a valer em todas as edge functions em até <strong>30 segundos</strong> (cache).
                Para trocar de instância, basta editar acima e salvar.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

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

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReiniciar}
                disabled={actionLoading}
              >
                <RotateCcw className={cn("h-4 w-4 mr-2", actionLoading && "animate-spin")} />
                Reiniciar Instância
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleConectar}
                disabled={actionLoading}
              >
                <Plug className={cn("h-4 w-4 mr-2")} />
                Forçar Conexão
              </Button>
              <Button
                variant={isDisconnected ? "default" : "outline"}
                size="sm"
                onClick={handleReconectar}
                disabled={actionLoading}
              >
                <Zap className={cn("h-4 w-4 mr-2", actionLoading && "animate-spin")} />
                Reconexão Completa
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={actionLoading || !status?.connected}
                  >
                    <PowerOff className="h-4 w-4 mr-2" />
                    Desconectar WhatsApp
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A instância ficará offline e o WhatsApp parará de receber e enviar mensagens
                      até você reconectar. Para voltar a usar, clique em "Forçar Conexão" e escaneie
                      um novo QR Code. A instância <strong>não será excluída</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDesconectar}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sim, desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

            {/* Auto-reconnect info */}
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertTitle>Reconexão Automática</AlertTitle>
              <AlertDescription>
                O sistema tenta reconectar automaticamente antes de cada envio de mensagem. 
                Se falhar, use o botão "Reconexão Completa" acima.
              </AlertDescription>
            </Alert>
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
                      href="https://secretaria-evolution.cloudfy.live" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      secretaria-evolution.cloudfy.live
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
                    Na lista de instâncias, clique na instância <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium">{status?.instanceName || "Secretaria"}</span> para abrir as opções.
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
              <li className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Novo:</strong> O envio de mensagens agora tenta reconectar automaticamente se detectar desconexão.</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ConfiguracoesEvolution;
