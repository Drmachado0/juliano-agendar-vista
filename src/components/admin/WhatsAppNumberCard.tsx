import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Phone, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { fetchSiteConfig, updateWhatsAppNumber } from "@/services/siteConfig";
import { refreshSiteWhatsApp } from "@/hooks/useSiteWhatsApp";
import { formatWhatsAppDisplay, normalizeWhatsApp } from "@/lib/whatsappNumber";

export default function WhatsAppNumberCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState("");
  const [initial, setInitial] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await fetchSiteConfig();
    const n = data?.whatsapp_number ?? "";
    setValue(n);
    setInitial(n);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const digits = normalizeWhatsApp(value);
  const valido = /^55\d{10,11}$/.test(digits);
  const alterado = digits !== normalizeWhatsApp(initial);

  async function salvar() {
    if (!valido) {
      toast.error("Número inválido. Use o formato 55 + DDD + número (ex: 5591980690617).");
      return;
    }
    setSaving(true);
    const { success, error } = await updateWhatsAppNumber(digits);
    if (success) {
      toast.success("Número atualizado em todo o site.");
      setInitial(digits);
      setValue(digits);
      refreshSiteWhatsApp();
    } else {
      toast.error(error || "Erro ao salvar");
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Número de WhatsApp do site
        </CardTitle>
        <CardDescription>
          Este número aparece em todos os botões "Fale conosco" e links wa.me do site público
          (header, footer, botão flutuante, página de obrigado, política de privacidade etc).
          Ao alterar e salvar, a mudança vale para todo o site imediatamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="wa-number">Número (formato internacional, só dígitos)</Label>
              <Input
                id="wa-number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="5591980690617"
                inputMode="numeric"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Inclua o código do país (55) + DDD + número. Exibição:{" "}
                <span className="font-medium">
                  {valido ? formatWhatsAppDisplay(digits) : "—"}
                </span>
              </p>
            </div>

            {!valido && value && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Formato inválido. Esperado: <code>55</code> + DDD (2 dígitos) + número (10 ou 11 dígitos).
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription className="text-xs">
                Importante: este campo controla apenas os <strong>links wa.me</strong> exibidos no
                site. A instância Z-API que envia mensagens (lembretes, confirmações, avaliações)
                continua usando o celular já pareado no painel da Z-API.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end">
              <Button onClick={salvar} disabled={saving || !valido || !alterado} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar número
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
