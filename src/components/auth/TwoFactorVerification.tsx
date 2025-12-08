import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TwoFactorVerificationProps {
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
}

const TwoFactorVerification = ({ userId, onVerified, onCancel }: TwoFactorVerificationProps) => {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (code.length < 6) {
      setError("Digite o código completo");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('totp-validate', {
        body: { user_id: userId, token: code }
      });

      if (invokeError) throw invokeError;

      if (data.verified) {
        onVerified();
      } else {
        setError(data.error || "Código inválido");
      }
    } catch (err) {
      console.error('2FA verification error:', err);
      setError("Falha na verificação. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length >= 6) {
      handleVerify();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle>Verificação em Duas Etapas</CardTitle>
        <CardDescription>
          Digite o código de 6 dígitos do seu aplicativo autenticador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="2fa-code">Código de verificação</Label>
          <Input
            id="2fa-code"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 8);
              setCode(value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            className="text-center text-2xl tracking-widest font-mono"
            maxLength={8}
            autoFocus
          />
          <p className="text-xs text-muted-foreground text-center">
            Ou use um código de backup de 8 caracteres
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button 
          className="w-full" 
          onClick={handleVerify}
          disabled={code.length < 6 || verifying}
        >
          {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Verificar
        </Button>

        <Button 
          variant="ghost" 
          className="w-full"
          onClick={onCancel}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao login
        </Button>
      </CardContent>
    </Card>
  );
};

export default TwoFactorVerification;