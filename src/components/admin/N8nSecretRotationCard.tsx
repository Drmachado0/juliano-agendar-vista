// ============================================================================
// N8nSecretRotationCard
// Painel admin para rotacionar o N8N_SHARED_SECRET (usado pelo n8n para
// chamar edge functions internas: mcp-agendamento, registrar-mensagem-in-n8n).
//
// - Mostra versão atual e quem/quando rotacionou por último.
// - Botão "Rotacionar" abre modal de confirmação (avisando invalidação imediata).
// - Após rotação, exibe o novo valor UMA ÚNICA VEZ com botão copiar.
// - Botão "Fechar" só habilita após copiar ou marcar "Já guardei".
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

type SecretInfo = {
  nome: string;
  versao: number | null;
  rotacionado_em: string | null;
  rotacionado_por_email: string | null;
  existe: boolean;
};

type RotationResult = {
  nome: string;
  valor: string;
  versao: number;
  rotacionado_em: string;
  rotacionado_por_email: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function N8nSecretRotationCard() {
  const [info, setInfo] = useState<SecretInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [revealed, setRevealed] = useState<RotationResult | null>(null);
  const [showValue, setShowValue] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aceitouGuardar, setAceitouGuardar] = useState(false);

  const carregarInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("info_secret_integracao", {
        p_nome: "N8N_SHARED_SECRET",
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setInfo(row as SecretInfo);
    } catch (e: any) {
      console.error("[N8nSecretRotationCard] info erro:", e);
      toast.error("Não foi possível ler o status do segredo", {
        description: e?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregarInfo();
  }, []);

  const executarRotacao = async () => {
    setRotating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "rotacionar-n8n-secret",
        { body: {} },
      );
      if (error) throw error;
      if (!data?.success || !data?.valor) {
        throw new Error(data?.error || "Resposta inválida do servidor");
      }
      setRevealed({
        nome: data.nome,
        valor: data.valor,
        versao: data.versao,
        rotacionado_em: data.rotacionado_em,
        rotacionado_por_email: data.rotacionado_por_email ?? null,
      });
      setConfirmOpen(false);
      setShowValue(true);
      setCopiado(false);
      setAceitouGuardar(false);
      await carregarInfo();
    } catch (e: any) {
      console.error("[N8nSecretRotationCard] rotação erro:", e);
      toast.error("Falha ao rotacionar segredo", { description: e?.message });
    } finally {
      setRotating(false);
    }
  };

  const copiarValor = async () => {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.valor);
      setCopiado(true);
      toast.success("Segredo copiado para a área de transferência");
    } catch (e: any) {
      toast.error("Não consegui copiar automaticamente", {
        description: "Selecione o texto manualmente.",
      });
    }
  };

  const fecharReveal = () => {
    // Limpa o valor do estado assim que o painel fecha
    setRevealed(null);
    setShowValue(false);
    setCopiado(false);
    setAceitouGuardar(false);
  };

  const podeFechar = copiado || aceitouGuardar;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Segredo compartilhado com o n8n
          </CardTitle>
          <CardDescription>
            <code>N8N_SHARED_SECRET</code> — usado pelas credenciais do n8n que
            chamam <code>mcp-agendamento</code> e{" "}
            <code>registrar-mensagem-in-n8n</code>. Rotacione se suspeitar de
            vazamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando status…
            </div>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground">Versão</div>
                <div className="font-medium">
                  {info?.existe ? (
                    <Badge variant="secondary">v{info.versao}</Badge>
                  ) : (
                    <Badge variant="outline">
                      não rotacionado (usa env var)
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Última rotação</div>
                <div className="font-medium">
                  {formatDate(info?.rotacionado_em ?? null)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Por</div>
                <div className="font-medium truncate">
                  {info?.rotacionado_por_email ?? "—"}
                </div>
              </div>
            </div>
          )}

          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Antes de rotacionar</AlertTitle>
            <AlertDescription>
              Tenha a aba do n8n aberta. Assim que confirmar, o valor antigo
              para de funcionar em até 60 segundos e você precisa colar o novo
              nas credenciais correspondentes.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Rotacionar segredo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de confirmação */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Confirmar rotação
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Isto vai gerar um novo valor para{" "}
                  <code>N8N_SHARED_SECRET</code> e invalidar o valor atual em
                  até 60 segundos.
                </p>
                <p>
                  Toda chamada do n8n com o segredo antigo passará a retornar{" "}
                  <code>Unauthorized</code> até você colar o novo valor em
                  <strong> todas as credenciais</strong> do n8n que usam esse
                  segredo (mcp-agendamento, registrar-mensagem-in-n8n e
                  quaisquer outras).
                </p>
                <p>O valor novo será mostrado uma única vez.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={rotating}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={executarRotacao}
              disabled={rotating}
              className="gap-2"
            >
              {rotating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Confirmar rotação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal com o valor (única exibição) */}
      <Dialog
        open={!!revealed}
        onOpenChange={(open) => {
          if (!open && podeFechar) fecharReveal();
        }}
      >
        <DialogContent
          className="max-w-lg"
          onInteractOutside={(e) => {
            if (!podeFechar) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!podeFechar) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Novo N8N_SHARED_SECRET (v{revealed?.versao})
            </DialogTitle>
            <DialogDescription>
              Este valor não será exibido de novo. Guarde num gerenciador de
              senhas antes de fechar.
            </DialogDescription>
          </DialogHeader>

          {revealed && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted p-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-xs">
                    {showValue
                      ? revealed.valor
                      : "•".repeat(Math.min(revealed.valor.length, 48))}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowValue((v) => !v)}
                    title={showValue ? "Ocultar" : "Mostrar"}
                  >
                    {showValue ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={copiarValor}
                    title="Copiar"
                  >
                    {copiado ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Cole em todas essas credenciais no n8n</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                    <li>
                      Credencial usada por <code>mcp-agendamento</code> (header{" "}
                      <code>x-n8n-secret</code> ou{" "}
                      <code>Authorization: Bearer</code>)
                    </li>
                    <li>
                      Credencial usada por{" "}
                      <code>registrar-mensagem-in-n8n</code> (header{" "}
                      <code>x-n8n-secret</code>)
                    </li>
                    <li>
                      Qualquer outro nó do n8n que valide esse segredo
                      compartilhado.
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>

              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={aceitouGuardar}
                  onCheckedChange={(v) => setAceitouGuardar(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Já copiei e/ou guardei este valor num gerenciador de senhas.
                </span>
              </label>
            </div>
          )}

          <DialogFooter>
            <Button onClick={fecharReveal} disabled={!podeFechar}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
