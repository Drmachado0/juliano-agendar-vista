import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Bot } from "lucide-react";
import { obterBotConfig, atualizarBotConfig, BotConfig } from "@/services/botPausa";

const BotConfigCard = () => {
  const [cfg, setCfg] = useState<BotConfig>({
    pausa_automatica_ativa: true,
    pausa_automatica_minutos: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    obterBotConfig().then((c) => {
      setCfg(c);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const min = Math.max(1, Math.min(cfg.pausa_automatica_minutos || 30, 1440));
    const { error } = await atualizarBotConfig({ ...cfg, pausa_automatica_minutos: min });
    setSaving(false);
    if (error) toast.error("Erro ao salvar: " + error);
    else toast.success("Configuração salva");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Bot — Pausa automática
        </CardTitle>
        <CardDescription>
          Quando alguém da equipe responde uma conversa pelo painel, o bot fica em silêncio
          por um período. Mensagens automáticas do sistema (lembretes, confirmações) não disparam pausa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="pausa-ativa" className="text-sm font-medium">
                  Pausar bot quando equipe responde
                </Label>
                <p className="text-xs text-muted-foreground">
                  Recomendado. Evita que o bot atrapalhe atendimentos humanos em andamento.
                </p>
              </div>
              <Switch
                id="pausa-ativa"
                checked={cfg.pausa_automatica_ativa}
                onCheckedChange={(v) => setCfg((p) => ({ ...p, pausa_automatica_ativa: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pausa-minutos" className="text-sm font-medium">
                Tempo de pausa (minutos)
              </Label>
              <Input
                id="pausa-minutos"
                type="number"
                min={1}
                max={1440}
                value={cfg.pausa_automatica_minutos}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    pausa_automatica_minutos: parseInt(e.target.value || "30", 10),
                  }))
                }
                className="max-w-[160px]"
                disabled={!cfg.pausa_automatica_ativa}
              />
              <p className="text-xs text-muted-foreground">
                Após esse tempo sem novas mensagens da equipe, o bot volta a responder na próxima
                mensagem do paciente. Padrão: 30 minutos.
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar configuração
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BotConfigCard;
