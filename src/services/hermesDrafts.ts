import { supabase } from "@/integrations/supabase/client";

export type HermesDraftStatus =
  | "pending"
  | "accepted"
  | "edited"
  | "discarded"
  | "sent"
  | "error";

export interface HermesDraft {
  id: string;
  agendamento_id: string | null;
  telefone: string | null;
  sugestao: string;
  conteudo_final: string | null;
  instrucao: string | null;
  modelo: string;
  latencia_ms: number | null;
  status: HermesDraftStatus;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  mensagem_id: string | null;
  contexto_resumo: any;
  created_at: string;
  updated_at: string;
}

export async function listarHermesDrafts(opts?: {
  agendamento_id?: string;
  status?: HermesDraftStatus;
  limit?: number;
}): Promise<{ data: HermesDraft[]; error: string | null }> {
  let q = supabase
    .from("hermes_drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);

  if (opts?.agendamento_id) q = q.eq("agendamento_id", opts.agendamento_id);
  if (opts?.status) q = q.eq("status", opts.status);

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data as HermesDraft[]) ?? [], error: null };
}

export async function marcarHermesDraftStatus(params: {
  draft_id: string;
  status: HermesDraftStatus;
  conteudo_final?: string | null;
  mensagem_id?: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("marcar_hermes_draft_status", {
    p_draft_id: params.draft_id,
    p_status: params.status,
    p_conteudo_final: params.conteudo_final ?? null,
    p_mensagem_id: params.mensagem_id ?? null,
  });
  if (error) return { error: error.message };
  return { error: null };
}
