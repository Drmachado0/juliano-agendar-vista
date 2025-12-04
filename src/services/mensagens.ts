import { supabase } from "@/integrations/supabase/client";

export interface MensagemWhatsApp {
  id: string;
  agendamento_id: string | null;
  telefone: string;
  direcao: "IN" | "OUT";
  conteudo: string;
  status_envio: string | null;
  mensagem_externa_id: string | null;
  lida: boolean;
  created_at: string;
}

export interface MensagemInsert {
  agendamento_id?: string;
  telefone: string;
  direcao: "IN" | "OUT";
  conteudo: string;
  status_envio?: string;
  mensagem_externa_id?: string;
}

export interface LeadComMensagens {
  agendamento_id: string;
  nome_completo: string;
  telefone_whatsapp: string;
  status_crm: string;
  local_atendimento: string;
  ultima_mensagem: string | null;
  ultima_mensagem_data: string | null;
  mensagens_nao_lidas: number;
}

// Helper to normalize phone numbers for comparison (get last 8 digits)
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-8);
};

// Listar mensagens de um agendamento específico (também busca por telefone para pegar todas)
export const listarMensagensPorAgendamento = async (
  agendamentoId: string,
  telefone?: string
): Promise<{ data: MensagemWhatsApp[]; error: Error | null }> => {
  try {
    // First try by agendamento_id
    let query = supabase
      .from("mensagens_whatsapp")
      .select("*")
      .eq("agendamento_id", agendamentoId)
      .order("created_at", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // If we have a phone number, also fetch messages by phone that might not be linked
    if (telefone) {
      const last8 = normalizePhone(telefone);
      const { data: phoneMsgs, error: phoneError } = await supabase
        .from("mensagens_whatsapp")
        .select("*")
        .ilike("telefone", `%${last8}%`)
        .is("agendamento_id", null)
        .order("created_at", { ascending: true });

      if (!phoneError && phoneMsgs && phoneMsgs.length > 0) {
        // Merge and deduplicate
        const allMsgs = [...(data || []), ...phoneMsgs];
        const uniqueMsgs = allMsgs.filter(
          (msg, index, self) => index === self.findIndex((m) => m.id === msg.id)
        );
        uniqueMsgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return { data: uniqueMsgs as MensagemWhatsApp[], error: null };
      }
    }

    return { data: (data as MensagemWhatsApp[]) || [], error: null };
  } catch (error) {
    console.error("Erro ao listar mensagens:", error);
    return { data: [], error: error as Error };
  }
};

// Listar leads com última mensagem e contagem de não lidas
export const listarLeadsComMensagens = async (
  filtroStatus?: string,
  termoBusca?: string
): Promise<{ data: LeadComMensagens[]; error: Error | null }> => {
  try {
    // Buscar agendamentos com telefone preenchido
    let query = supabase
      .from("agendamentos")
      .select("id, nome_completo, telefone_whatsapp, status_crm, local_atendimento")
      .not("telefone_whatsapp", "is", null)
      .neq("telefone_whatsapp", "");

    if (filtroStatus && filtroStatus !== "TODOS") {
      query = query.eq("status_crm", filtroStatus);
    }

    if (termoBusca) {
      query = query.or(
        `nome_completo.ilike.%${termoBusca}%,telefone_whatsapp.ilike.%${termoBusca}%`
      );
    }

    const { data: agendamentos, error: agendamentosError } = await query;

    if (agendamentosError) throw agendamentosError;

    if (!agendamentos || agendamentos.length === 0) {
      return { data: [], error: null };
    }

    // Buscar mensagens para cada agendamento
    const agendamentoIds = agendamentos.map((a) => a.id);
    
    const { data: mensagens, error: mensagensError } = await supabase
      .from("mensagens_whatsapp")
      .select("*")
      .in("agendamento_id", agendamentoIds)
      .order("created_at", { ascending: false });

    if (mensagensError) throw mensagensError;

    // Mapear leads com suas mensagens
    const leadsComMensagens: LeadComMensagens[] = agendamentos.map((agendamento) => {
      const mensagensDoLead = (mensagens || []).filter(
        (m) => m.agendamento_id === agendamento.id
      );
      
      const ultimaMensagem = mensagensDoLead[0];
      const mensagensNaoLidas = mensagensDoLead.filter(
        (m) => m.direcao === "IN" && !m.lida
      ).length;

      return {
        agendamento_id: agendamento.id,
        nome_completo: agendamento.nome_completo,
        telefone_whatsapp: agendamento.telefone_whatsapp,
        status_crm: agendamento.status_crm,
        local_atendimento: agendamento.local_atendimento,
        ultima_mensagem: ultimaMensagem?.conteudo || null,
        ultima_mensagem_data: ultimaMensagem?.created_at || null,
        mensagens_nao_lidas: mensagensNaoLidas,
      };
    });

    // Ordenar por última mensagem (mais recente primeiro)
    leadsComMensagens.sort((a, b) => {
      if (!a.ultima_mensagem_data && !b.ultima_mensagem_data) return 0;
      if (!a.ultima_mensagem_data) return 1;
      if (!b.ultima_mensagem_data) return -1;
      return new Date(b.ultima_mensagem_data).getTime() - new Date(a.ultima_mensagem_data).getTime();
    });

    return { data: leadsComMensagens, error: null };
  } catch (error) {
    console.error("Erro ao listar leads com mensagens:", error);
    return { data: [], error: error as Error };
  }
};

// Inserir nova mensagem
export const inserirMensagem = async (
  mensagem: MensagemInsert
): Promise<{ data: MensagemWhatsApp | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from("mensagens_whatsapp")
      .insert(mensagem)
      .select()
      .single();

    if (error) throw error;

    return { data: data as MensagemWhatsApp, error: null };
  } catch (error) {
    console.error("Erro ao inserir mensagem:", error);
    return { data: null, error: error as Error };
  }
};

// Marcar mensagens como lidas
export const marcarMensagensComoLidas = async (
  agendamentoId: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from("mensagens_whatsapp")
      .update({ lida: true })
      .eq("agendamento_id", agendamentoId)
      .eq("direcao", "IN")
      .eq("lida", false);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error("Erro ao marcar mensagens como lidas:", error);
    return { error: error as Error };
  }
};

// Buscar agendamento por ID (para o chat)
export const buscarAgendamentoParaChat = async (
  agendamentoId: string
): Promise<{ data: any | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("id", agendamentoId)
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error("Erro ao buscar agendamento:", error);
    return { data: null, error: error as Error };
  }
};
