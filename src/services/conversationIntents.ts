import { supabase } from "@/integrations/supabase/client";

export interface ConversationIntent {
  id: string;
  agendamento_id: string | null;
  mensagem_id: string | null;
  telefone: string;
  intencao: string;
  confianca: number | null;
  resumo: string | null;
  sentimento: string | null;
  proxima_acao: string | null;
  modelo: string;
  created_at: string;
}

export const INTENCAO_LABEL: Record<string, string> = {
  agendar: "Quer agendar",
  remarcar: "Quer remarcar",
  cancelar: "Quer cancelar",
  confirmar_presenca: "Confirmando presença",
  duvida_preco: "Dúvida de preço",
  duvida_convenio: "Dúvida de convênio",
  duvida_endereco: "Dúvida de endereço",
  duvida_horario: "Dúvida de horário",
  pos_consulta: "Pós-consulta",
  urgencia: "Urgência",
  saudacao: "Saudação",
  outros: "Outros",
};

export const INTENCAO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  agendar: "default",
  remarcar: "default",
  cancelar: "destructive",
  urgencia: "destructive",
  confirmar_presenca: "secondary",
};

export async function buscarUltimaIntencao(
  agendamentoId: string,
): Promise<ConversationIntent | null> {
  const { data, error } = await supabase
    .from("conversation_intents")
    .select("*")
    .eq("agendamento_id", agendamentoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("buscarUltimaIntencao:", error);
    return null;
  }
  return data as ConversationIntent | null;
}
