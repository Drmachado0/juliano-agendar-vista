import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Cookie, ShieldCheck } from "lucide-react";
import {
  acceptAll,
  getConsent,
  hasDecided,
  rejectAll,
  setConsent,
  OPEN_PREFERENCES_EVENT,
} from "@/lib/consent";
import { applyConsentToScripts } from "@/lib/loadTrackingScripts";
import { isPrivateRoute } from "@/lib/trackingGuard";

/**
 * Banner de cookies (LGPD).
 *
 * Compacto no mobile por decisão de mídia paga (avaliação Meta Ads 04/09/2026):
 * a versão anterior ocupava ~253 px de um viewport de 844 px (30% da tela) e
 * escondia o topo da página de agendamento para quem chega do anúncio.
 * Agora: uma frase curta, dois botões na mesma linha e "Personalizar" como
 * link dentro do texto — cerca de 120 px no mobile.
 */
export default function ConsentBanner() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    if (isPrivateRoute(location.pathname)) {
      setVisible(false);
      return;
    }
    const decided = hasDecided();
    if (!decided) {
      setVisible(true);
    } else {
      // Re-aplica scripts se já consentido (caso usuário recarregue)
      const c = getConsent();
      if (c) applyConsentToScripts({ analytics: c.analytics, marketing: c.marketing });
    }
  }, [location.pathname]);

  useEffect(() => {
    const open = () => {
      const c = getConsent();
      if (c) {
        setAnalytics(c.analytics);
        setMarketing(c.marketing);
      }
      setPrefsOpen(true);
    };
    window.addEventListener(OPEN_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, open);
  }, []);

  const handleAcceptAll = () => {
    const state = acceptAll();
    applyConsentToScripts({ analytics: state.analytics, marketing: state.marketing });
    setVisible(false);
    setPrefsOpen(false);
  };

  const handleRejectAll = () => {
    rejectAll();
    setVisible(false);
    setPrefsOpen(false);
  };

  const handleSavePrefs = () => {
    const state = setConsent({ analytics, marketing });
    applyConsentToScripts({ analytics: state.analytics, marketing: state.marketing });
    setVisible(false);
    setPrefsOpen(false);
  };

  if (isPrivateRoute(location.pathname)) return null;

  return (
    <>
      {visible && (
        <div
          role="dialog"
          aria-label="Aviso de cookies"
          className="fixed bottom-0 inset-x-0 z-[60] p-2 sm:p-4 animate-in slide-in-from-bottom duration-500"
        >
          <div className="max-w-5xl mx-auto rounded-xl sm:rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-2xl shadow-background/50 p-3 sm:p-5">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 sm:items-center">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <div className="hidden sm:flex w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 items-center justify-center shrink-0">
                  <Cookie className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                  <strong className="text-foreground">Cookies:</strong> usamos para medir o
                  site e as campanhas.{" "}
                  <Link
                    to="/politica-de-privacidade"
                    className="text-primary hover:underline font-medium whitespace-nowrap"
                  >
                    Política de Privacidade
                  </Link>
                  <span aria-hidden="true"> · </span>
                  <button
                    type="button"
                    onClick={() => setPrefsOpen(true)}
                    className="text-primary hover:underline font-medium"
                  >
                    Personalizar
                  </button>
                </p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRejectAll}
                  className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                >
                  Rejeitar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAcceptAll}
                  className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0"
                >
                  Aceitar todos
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Preferências de privacidade
            </DialogTitle>
            <DialogDescription>
              Escolha quais categorias de cookies deseja autorizar. Você pode alterar a qualquer momento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border/60 bg-muted/30">
              <div>
                <div className="font-semibold text-sm text-foreground">Necessários</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Essenciais para funcionamento do site (sessão, segurança, agendamento). Sempre ativos.
                </p>
              </div>
              <Switch checked disabled aria-label="Necessários (sempre ativo)" />
            </div>

            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border/60">
              <div>
                <div className="font-semibold text-sm text-foreground">Analytics</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Google Analytics / GTM para medir uso do site e melhorar a experiência.
                </p>
              </div>
              <Switch
                checked={analytics}
                onCheckedChange={setAnalytics}
                aria-label="Cookies de analytics"
              />
            </div>

            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border border-border/60">
              <div>
                <div className="font-semibold text-sm text-foreground">Marketing</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Meta Pixel e Google Ads para mensurar campanhas e personalizar anúncios.
                </p>
              </div>
              <Switch
                checked={marketing}
                onCheckedChange={setMarketing}
                aria-label="Cookies de marketing"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleRejectAll} className="w-full sm:w-auto">
              Rejeitar todos
            </Button>
            <Button variant="ghost" onClick={handleAcceptAll} className="w-full sm:w-auto">
              Aceitar todos
            </Button>
            <Button onClick={handleSavePrefs} className="w-full sm:w-auto">
              Salvar preferências
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
