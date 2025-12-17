import { supabase } from "@/integrations/supabase/client";

export interface LembreteAnual {
  id: string;
  telefone: string;
  nome: string;
  primeiro_nome: string | null;
  data_ultima_consulta: string;
  data_proximo_lembrete: string;
  lembrete_enviado: boolean;
  lembrete_enviado_em: string | null;
  origem: string;
  created_at: string;
  updated_at: string;
}

export interface PacienteN8n {
  id: string;
  nome: string;
  primeiro_nome: string;
  telefone: string;
  telefone_formatado: string;
  data_atendimento: string;
  data_atendimento_formatada: string;
}

export interface N8nResponse {
  sucesso: boolean;
  data_consulta: string;
  total_pacientes: number;
  pacientes: PacienteN8n[];
}

const N8N_WEBHOOK_URL = "https://juliano-n8n.cloudfy.live/webhook/avaliacao-google-lovable";

// Fetch patients from n8n webhook
export async function buscarPacientesN8n(dataAtendimento: string): Promise<{ data: PacienteN8n[] | null; error: string | null }> {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data_atendimento: dataAtendimento }),
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data: N8nResponse = await response.json();

    if (!data.sucesso) {
      throw new Error("Falha ao buscar pacientes do sistema");
    }

    return { data: data.pacientes || [], error: null };
  } catch (error: any) {
    console.error("Erro ao buscar pacientes n8n:", error);
    return { data: null, error: error.message || "Erro ao conectar com o sistema" };
  }
}

// List all lembretes from database
export async function listarLembretes(): Promise<{ data: LembreteAnual[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("lembretes_anuais")
      .select("*")
      .order("data_proximo_lembrete", { ascending: true });

    if (error) throw error;
    return { data: data as LembreteAnual[], error: null };
  } catch (error: any) {
    console.error("Erro ao listar lembretes:", error);
    return { data: null, error: error.message };
  }
}

// List pending lembretes (not sent yet and due date <= today or within range)
export async function listarLembretesPendentes(filtro: 'vencidos' | 'semana' | 'mes' | 'todos' = 'todos'): Promise<{ data: LembreteAnual[] | null; error: string | null }> {
  try {
    const hoje = new Date();
    let query = supabase
      .from("lembretes_anuais")
      .select("*")
      .eq("lembrete_enviado", false)
      .order("data_proximo_lembrete", { ascending: true });

    if (filtro === 'vencidos') {
      query = query.lte("data_proximo_lembrete", hoje.toISOString().split('T')[0]);
    } else if (filtro === 'semana') {
      const proximaSemana = new Date(hoje);
      proximaSemana.setDate(proximaSemana.getDate() + 7);
      query = query.lte("data_proximo_lembrete", proximaSemana.toISOString().split('T')[0]);
    } else if (filtro === 'mes') {
      const proximoMes = new Date(hoje);
      proximoMes.setMonth(proximoMes.getMonth() + 1);
      query = query.lte("data_proximo_lembrete", proximoMes.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data: data as LembreteAnual[], error: null };
  } catch (error: any) {
    console.error("Erro ao listar lembretes pendentes:", error);
    return { data: null, error: error.message };
  }
}

// Save patients to lembretes table
export async function salvarPacientesComoLembretes(pacientes: PacienteN8n[]): Promise<{ success: boolean; inserted: number; error: string | null }> {
  try {
    const registros = pacientes.map(p => ({
      telefone: p.telefone,
      nome: p.nome,
      primeiro_nome: p.primeiro_nome,
      data_ultima_consulta: p.data_atendimento,
      origem: 'n8n'
    }));

    const { data, error } = await supabase
      .from("lembretes_anuais")
      .upsert(registros, { onConflict: 'telefone,data_ultima_consulta', ignoreDuplicates: true })
      .select();

    if (error) throw error;
    return { success: true, inserted: data?.length || 0, error: null };
  } catch (error: any) {
    console.error("Erro ao salvar lembretes:", error);
    return { success: false, inserted: 0, error: error.message };
  }
}

// Mark lembrete as sent
export async function marcarLembreteEnviado(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from("lembretes_anuais")
      .update({ 
        lembrete_enviado: true, 
        lembrete_enviado_em: new Date().toISOString() 
      })
      .eq("id", id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error: any) {
    console.error("Erro ao marcar lembrete como enviado:", error);
    return { success: false, error: error.message };
  }
}

// Get existing phone numbers in lembretes table
export async function buscarTelefonesExistentes(): Promise<{ data: Set<string> | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("lembretes_anuais")
      .select("telefone, data_ultima_consulta");

    if (error) throw error;
    
    // Create set with normalized phone + date combination to avoid duplicates
    const existentes = new Set(
      (data || []).map(l => `${l.telefone.replace(/\D/g, '').slice(-8)}_${l.data_ultima_consulta}`)
    );
    
    return { data: existentes, error: null };
  } catch (error: any) {
    console.error("Erro ao buscar telefones existentes:", error);
    return { data: null, error: error.message };
  }
}

// Delete lembrete
export async function deletarLembrete(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from("lembretes_anuais")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error: any) {
    console.error("Erro ao deletar lembrete:", error);
    return { success: false, error: error.message };
  }
}
