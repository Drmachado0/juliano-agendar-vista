import { supabase } from "@/integrations/supabase/client";

export interface JanelaAtendimento {
  id: string;
  ano_referencia: number;
  mes_referencia: number; // 1..12
  numero_janela: 1 | 2;
  data_inicio: string; // ISO date
  data_fim: string;
  data_envio_sugerida: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface JanelaStatus extends JanelaAtendimento {
  remessa_id: string | null;
  remessa_status: string | null;
  data_programada: string | null;
  pacientes_pendentes: number;
  pacientes_enviados: number;
  pacientes_falhas: number;
  pacientes_ignorados: number;
}

export async function listarJanelasMes(ano: number, mes1a12: number): Promise<JanelaAtendimento[]> {
  const { data, error } = await supabase
    .from("janelas_atendimento_lembretes" as any)
    .select("*")
    .eq("ano_referencia", ano)
    .eq("mes_referencia", mes1a12)
    .order("numero_janela", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as JanelaAtendimento[];
}

export async function upsertJanela(j: Omit<JanelaAtendimento, "id" | "created_at" | "updated_at"> & { id?: string }) {
  const payload: any = {
    ano_referencia: j.ano_referencia,
    mes_referencia: j.mes_referencia,
    numero_janela: j.numero_janela,
    data_inicio: j.data_inicio,
    data_fim: j.data_fim,
    data_envio_sugerida: j.data_envio_sugerida,
    observacao: j.observacao ?? null,
  };
  if (j.id) {
    const { data, error } = await supabase
      .from("janelas_atendimento_lembretes" as any)
      .update(payload)
      .eq("id", j.id)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as JanelaAtendimento;
  }
  const { data, error } = await supabase
    .from("janelas_atendimento_lembretes" as any)
    .upsert(payload, { onConflict: "ano_referencia,mes_referencia,numero_janela" })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as JanelaAtendimento;
}

export async function excluirJanela(id: string) {
  const { error } = await supabase
    .from("janelas_atendimento_lembretes" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listarStatusJanelasAtual(): Promise<JanelaStatus[]> {
  const { data, error } = await supabase
    .from("vw_status_janelas_atual" as any)
    .select("*");
  if (error) throw error;
  return (data || []) as unknown as JanelaStatus[];
}
