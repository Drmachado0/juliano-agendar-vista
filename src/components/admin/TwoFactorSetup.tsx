import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import QRCode from "qrcode";

interface TwoFactorStatus {
  enabled: boolean;
  verified_at: string | null;
}

const TwoFactorSetup = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<{
    secret: string;
    totpUri: string;
    backupCodes: string[];
    qrCodeUrl: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [step, setStep] = useState<'qr' | 'verify' | 'backup'>('qr');

  useEffect(() => {
    fetchStatus();
  }, [user]);

  const fetchStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('two_factor_auth')
        .select('totp_enabled, verified_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      setStatus(data ? { enabled: data.totp_enabled, verified_at: data.verified_at } : { enabled: false, verified_at: null });
    } catch (error) {
      console.error('Error fetching 2FA status:', error);
      setStatus({ enabled: false, verified_at: null });
    } finally {
      setLoading(false);
    }
  };

  const initiateSetup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('totp-setup');

      if (error) throw error;

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(data.totpUri, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });

      setSetupData({
        secret: data.secret,
        totpUri: data.totpUri,
        backupCodes: data.backupCodes,
        qrCodeUrl
      });
      setShowSetupDialog(true);
      setStep('qr');
    } catch (error) {
      console.error('Error initiating 2FA setup:', error);
      toast({
        title: "Erro",
        description: "Falha ao iniciar configuração do 2FA",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!setupData || verificationCode.length !== 6) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('totp-verify', {
        body: {
          token: verificationCode,
          secret: setupData.secret,
          action: 'enable'
        }
      });

      if (error || !data.success) {
        throw new Error(data?.error || 'Verification failed');
      }

      setStep('backup');
      toast({
        title: "2FA Ativado!",
        description: "Autenticação de dois fatores foi ativada com sucesso."
      });
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      toast({
        title: "Código inválido",
        description: "Verifique o código e tente novamente",
        variant: "destructive"
      });
    } finally {
      setVerifying(false);
    }
  };

  const finishSetup = () => {
    setShowSetupDialog(false);
    setSetupData(null);
    setVerificationCode("");
    setStep('qr');
    fetchStatus();
  };

  const disable2FA = async () => {
    setDisabling(true);
    try {
      const { error } = await supabase.functions.invoke('totp-disable');

      if (error) throw error;

      toast({
        title: "2FA Desativado",
        description: "Autenticação de dois fatores foi desativada."
      });
      setShowDisableDialog(false);
      fetchStatus();
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      toast({
        title: "Erro",
        description: "Falha ao desativar 2FA",
        variant: "destructive"
      });
    } finally {
      setDisabling(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'secret' | 'codes') => {
    await navigator.clipboard.writeText(text);
    if (type === 'secret') {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Autenticação de Dois Fatores (2FA)</CardTitle>
                <CardDescription>
                  Adicione uma camada extra de segurança à sua conta
                </CardDescription>
              </div>
            </div>
            {status?.enabled ? (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                Ativado
              </Badge>
            ) : (
              <Badge variant="secondary">
                <ShieldOff className="h-3.5 w-3.5 mr-1" />
                Desativado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.enabled ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sua conta está protegida com autenticação de dois fatores.
                {status.verified_at && (
                  <span className="block mt-1">
                    Ativado em: {new Date(status.verified_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </p>
              <Button variant="destructive" onClick={() => setShowDisableDialog(true)}>
                <ShieldOff className="h-4 w-4 mr-2" />
                Desativar 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use um aplicativo autenticador (Google Authenticator, Authy, etc.) para gerar códigos de verificação ao fazer login.
              </p>
              <Button onClick={initiateSetup} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Shield className="h-4 w-4 mr-2" />
                Configurar 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === 'qr' && 'Escaneie o QR Code'}
              {step === 'verify' && 'Verificar Código'}
              {step === 'backup' && 'Códigos de Backup'}
            </DialogTitle>
            <DialogDescription>
              {step === 'qr' && 'Use seu aplicativo autenticador para escanear o código'}
              {step === 'verify' && 'Digite o código de 6 dígitos do seu aplicativo'}
              {step === 'backup' && 'Salve estes códigos em um lugar seguro'}
            </DialogDescription>
          </DialogHeader>

          {step === 'qr' && setupData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img src={setupData.qrCodeUrl} alt="QR Code" className="rounded-lg border" />
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Ou digite a chave manualmente:</Label>
                <div className="flex gap-2">
                  <Input 
                    value={setupData.secret} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(setupData.secret, 'secret')}
                  >
                    {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button className="w-full" onClick={() => setStep('verify')}>
                Próximo
              </Button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de verificação</Label>
                <Input
                  id="code"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest font-mono"
                  maxLength={6}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep('qr')}>
                  Voltar
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={verifyAndEnable}
                  disabled={verificationCode.length !== 6 || verifying}
                >
                  {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verificar
                </Button>
              </div>
            </div>
          )}

          {step === 'backup' && setupData && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Guarde estes códigos em um lugar seguro. Cada código só pode ser usado uma vez.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
                {setupData.backupCodes.map((code, i) => (
                  <code key={i} className="text-sm font-mono text-center py-1">
                    {code}
                  </code>
                ))}
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => copyToClipboard(setupData.backupCodes.join('\n'), 'codes')}
              >
                {copiedCodes ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedCodes ? 'Copiado!' : 'Copiar códigos'}
              </Button>

              <Button className="w-full" onClick={finishSetup}>
                Concluir
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar 2FA?</DialogTitle>
            <DialogDescription>
              Isso removerá a proteção adicional da sua conta. Você pode reativar a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={disable2FA} disabled={disabling}>
              {disabling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TwoFactorSetup;