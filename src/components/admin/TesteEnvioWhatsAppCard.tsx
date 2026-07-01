import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Send, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { registrarLogAdmin } from "@/services/systemLogs";
import { toast } from "sonner";

interface TestResult {
  ok: boolean;
  status?: number;
  messageId?: string | null;
  elapsed?: string;
  error?: string;
  raw?: any;
  timestamp: string;
}

export default function TesteEnvioWhatsAppCard() {
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState(
    "🧪 Teste de disparo via enviar-whatsapp — se você recebeu esta mensagem, o webhook do n8n está OK."
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const handleTest = async () => {
    const phone = telefone.replace(/\D/g, "");
    if (phone.length < 10) {
      toast.error("Informe um telefone válido (com DDD).");
      return;
    }
    if (!mensagem.trim()) {
      toast.error("Informe a mensagem de teste.");
      return;
    }

    setLoading(true);
    setResult(null);
    const startedAt = Date.now();

    try {
      const { data, error } = await supabase.functions.invoke("enviar-whatsapp", {
        body: {
          telefone: phone,
          mensagem: mensagem.trim(),
          tipo_mensagem: "teste_admin",
        },
      });

      const elapsedLocal = `${Date.now() - startedAt}ms`;
      const timestamp = new Date().toISOString();

      if (error) {
        const res: TestResult = {
          ok: false,
          error: error.message || "Erro de invocação",
          elapsed: elapsedLocal,
          timestamp,
          raw: error,
        };
        setResult(res);
        await registrarLogAdmin({
          level: "error",
          category: "whatsapp",
          source: "teste-admin-envio-whatsapp",
          message: `Teste manual FALHOU (invocação): ${res.error}`,
          details: { telefone_masked: `***${phone.slice(-4)}`, elapsed: elapsedLocal, error: res.error },
        });
        toast.error("Falha ao invocar a edge function.");
        return;
      }

      const okResp = data?.ok === true || data?.success === true;
      const res: TestResult = {
        ok: okResp,
        messageId: data?.messageId ?? null,
        elapsed: data?.elapsed ?? elapsedLocal,
        error: okResp ? undefined : (data?.erro || data?.error || "Erro desconhecido"),
        raw: data,
        timestamp,
      };
      setResult(res);

      await registrarLogAdmin({
        level: okResp ? "info" : "error",
        category: "whatsapp",
        source: "teste-admin-envio-whatsapp",
        message: okResp
          ? `Teste manual OK — messageId=${res.messageId ?? "n/a"}`
          : `Teste manual FALHOU: ${res.error}`,
        details: {
          telefone_masked: `***${phone.slice(-4)}`,
          elapsed: res.elapsed,
          messageId: res.messageId,
          response: data,
        },
      });

      if (okResp) toast.success("Mensagem enviada. Webhook do n8n respondeu OK.");
      else toast.error(`Falha: ${res.error}`);
    } catch (err: any) {
      const res: TestResult = {
        ok: false,
        error: err?.message || "Exceção inesperada",
        elapsed: `${Date.now() - startedAt}ms`,
        timestamp: new Date().toISOString(),
      };
      setResult(res);
      await registrarLogAdmin({
        level: "error",
        category: "whatsapp",
        source: "teste-admin-envio-whatsapp",
        message: `Teste manual EXCEÇÃO: ${res.error}`,
        details: { telefone_masked: `***${phone.slice(-4)}`, error: res.error },
      });
      toast.error("Exceção ao testar envio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Teste de envio WhatsApp (n8n)
        </CardTitle>
        <CardDescription>
          Dispara uma mensagem OUT pela edge function <code>enviar-whatsapp</code> e valida a resposta do webhook do n8n.
          O resultado fica registrado em Logs (categoria <code>whatsapp</code>, source <code>teste-admin-envio-whatsapp</code>).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="teste-telefone">Telefone (com DDD)</Label>
          <Input
            id="teste-telefone"
            placeholder="91991150174"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="teste-mensagem">Mensagem</Label>
          <Textarea
            id="teste-mensagem"
            rows={3}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button onClick={handleTest} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? "Enviando..." : "Disparar teste"}
        </Button>

        {result && (
          <div className="rounded-md border p-4 space-y-2 bg-muted/30">
            <div className="flex items-center gap-2">
              {result.ok ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    Sucesso
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                    Falha
                  </Badge>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(result.timestamp).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Tempo:</span> {result.elapsed ?? "-"}</div>
              <div><span className="text-muted-foreground">messageId:</span> {result.messageId ?? "-"}</div>
            </div>
            {result.error && (
              <div className="text-sm text-red-600 break-words">
                <span className="font-medium">Erro:</span> {result.error}
              </div>
            )}
            {result.raw && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Resposta bruta</summary>
                <pre className="mt-2 overflow-auto rounded bg-background p-2 text-[11px] max-h-60">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
