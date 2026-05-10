import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Webhook, Save, PlayCircle, Loader2 } from "lucide-react";

const EVENTS = [
  { event: "lead.created", label: "Lead criado" },
  { event: "paciente.needs_human", label: "Precisa de humano" },
  { event: "agendamento.lembrete_d1", label: "Lembrete D-1" },
] as const;

type Endpoint = {
  event: string;
  url: string;
  secret: string | null;
  active: boolean;
  description: string | null;
};

type Draft = { url: string; secret: string; active: boolean };

const AdminWebhooks = () => {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["crm_webhook_endpoints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_webhook_endpoints")
        .select("*")
        .order("event");
      if (error) throw error;
      return (data ?? []) as Endpoint[];
    },
  });

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [testingEvent, setTestingEvent] = useState<string | null>(null);

  useEffect(() => {
    if (!rows) return;
    const init: Record<string, Draft> = {};
    for (const r of rows) {
      init[r.event] = {
        url: r.url ?? "",
        secret: r.secret ?? "",
        active: !!r.active,
      };
    }
    setDrafts(init);
  }, [rows]);

  const upsert = useMutation({
    mutationFn: async (row: { event: string; url: string; secret: string; active: boolean }) => {
      const existing = rows?.find((r) => r.event === row.event);
      const { error } = await supabase
        .from("crm_webhook_endpoints")
        .upsert(
          { ...row, description: existing?.description ?? null },
          { onConflict: "event" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_webhook_endpoints"] });
      toast({ title: "Webhook salvo" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    },
  });

  const testar = async (event: string) => {
    setTestingEvent(event);
    try {
      const { data, error } = await supabase.functions.invoke("test-webhook", {
        body: { event },
      });
      if (error) throw error;
      toast({
        title: data?.ok ? "Disparo enviado" : "Falha no disparo",
        description: data?.ok
          ? `request_id: ${JSON.stringify(data?.request_id ?? "")}`
          : JSON.stringify(data?.error ?? error),
        variant: data?.ok ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message, variant: "destructive" });
    } finally {
      setTestingEvent(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Webhook className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Webhooks (n8n)</h1>
            <p className="text-xs text-muted-foreground">
              Endpoints reversos disparados pelo CRM para o n8n. RLS protege a leitura/escrita.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {EVENTS.map(({ event, label }) => {
              const row = rows?.find((r) => r.event === event);
              const draft = drafts[event] ?? { url: "", secret: "", active: false };
              const setDraft = (patch: Partial<Draft>) =>
                setDrafts((prev) => ({ ...prev, [event]: { ...draft, ...patch } }));
              const dirty =
                row &&
                (row.url !== draft.url ||
                  (row.secret ?? "") !== draft.secret ||
                  !!row.active !== draft.active);

              return (
                <Card key={event} className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {event}
                        </Badge>
                        <span className="font-semibold text-foreground">{label}</span>
                      </div>
                      {row?.description && (
                        <p className="text-xs text-muted-foreground">{row.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${event}`} className="text-xs">
                        Ativo
                      </Label>
                      <Switch
                        id={`active-${event}`}
                        checked={draft.active}
                        onCheckedChange={(v) => setDraft({ active: v })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">URL (n8n webhook)</Label>
                      <Input
                        type="url"
                        placeholder="https://n8n.exemplo.com/webhook/..."
                        value={draft.url}
                        onChange={(e) => setDraft({ url: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Secret (header X-Webhook-Secret)</Label>
                      <Input
                        type="password"
                        placeholder="opcional"
                        value={draft.secret}
                        onChange={(e) => setDraft({ secret: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testar(event)}
                      disabled={!draft.active || !draft.url || testingEvent === event}
                    >
                      {testingEvent === event ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4 mr-2" />
                      )}
                      Testar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        upsert.mutate({
                          event,
                          url: draft.url,
                          secret: draft.secret,
                          active: draft.active,
                        })
                      }
                      disabled={!dirty || upsert.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminWebhooks;
