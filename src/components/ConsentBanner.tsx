import { useEffect, useState, useRef } from "react";
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
import { cn } from "@/lib/utils";

export default function ConsentBanner() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPrivateRoute(location.pathname)) {
      setVisible(false);
      return;
    }
    const decided = hasDecided();
    if (!decided) {
      setVisible(true);
    } else {
      const c = getConsent();
      if (c) applyConsentToScripts({ analytics: c.analytics, marketing: c.marketing });
    }
  }, [location.pathname]);

  // Reserva espaço para o banner no body para não sobrepor conteúdo
  useEffect(() => {
    if (!visible || !bannerRef.current) {
      document.body.style.paddingBottom = "0px";
      return;
    }

    const updatePadding = () => {
      if (bannerRef.current) {
        const height = bannerRef.current.offsetHeight;
        document.body.style.paddingBottom = `${height}px`;
      }
    };

    const resizeObserver = new ResizeObserver(updatePadding);
    resizeObserver.observe(bannerRef.current);
    updatePadding();

    return () => {
      resizeObserver.disconnect();
      document.body.style.paddingBottom = "0px";
    };
  }, [visible]);

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
          ref={bannerRef}
          role="dialog"
          aria-label="Aviso de cookies"
          className={cn(
            "fixed bottom-0 inset-x-0 z-[60] animate-in slide-in-from-bottom duration-500",
            "bg-card/98 backdrop-blur-xl border-t border-primary/20 shadow-2xl shadow-background/50",
            "pb-[env(safe-area-inset-bottom)]"
          )}
        >
          <div className="max-w-5xl mx-auto p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-center text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 flex-1 overflow-hidden">
              <div className="hidden sm:flex w-10 h-10 rounded-lg bg-primary/15 border border-primary/25 items-center justify-center shrink-0">
                <Cookie className="w-5 h-5 text-primary" />
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed overflow-y-auto max-h-[15vh] sm:max-h-none px-2 sm:px-0">
                <strong className="text-foreground">Privacidade & cookies.</strong>{" "}
                Usamos cookies para melhorar sua experiência e medir o desempenho do site.{" "}
                <Link
                  to="/politica-de-privacidade"
                  className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  Política de Privacidade
                </Link>
                .
              </div>
            </div>
            
            <div className="flex flex-col gap-3 w-full sm:w-auto shrink-0">
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleRejectAll}
                  className="w-full sm:w-auto min-h-[44px] px-6 text-sm font-semibold"
                >
                  Rejeitar
                </Button>
                <Button
                  variant="default"
                  size="default"
                  onClick={handleAcceptAll}
                  className="w-full sm:w-auto min-h-[44px] px-6 text-sm font-semibold"
                >
                  Aceitar todos
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPrefsOpen(true)}
                className="w-full sm:w-auto h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                Personalizar escolhas
              </Button>
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
