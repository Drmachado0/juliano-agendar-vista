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
  erro?: string;
}

// Fetch patients from SaúdeViaNet via Edge Function
export async function buscarPacientesN8n(dataAtendimento: string): Promise<{ data: PacienteN8n[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('buscar-pacientes-saudevianet', {
      body: { data_atendimento: dataAtendimento },
    });

    if (error) {
      throw new Error(`Erro ao chamar SaúdeViaNet: ${error.message}`);
    }

    const response = data as N8nResponse;

    if (!response?.sucesso) {
      throw new Error(response?.erro || "Falha ao buscar pacientes do sistema");
    }

    return { data: response.pacientes || [], error: null };
  } catch (error: any) {
    console.error("Erro ao buscar pacientes SaúdeViaNet:", error);
    return { data: null, error: error.message || "Erro ao conectar com o SaúdeViaNet" };
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
export async function listarLembretesPendentes(filtro: string = 'todos'): Promise<{ data: LembreteAnual[] | null; error: string | null }> {
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
    } else if (filtro.startsWith('mes_')) {
      // Filter by specific month: mes_2025-01, mes_2025-02, etc.
      const mesAno = filtro.replace('mes_', '');
      const [ano, mes] = mesAno.split('-');
      const inicioMes = `${ano}-${mes}-01`;
      const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
      const fimMes = `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`;
      
      query = query
        .gte("data_proximo_lembrete", inicioMes)
        .lte("data_proximo_lembrete", fimMes);
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

// Statistics interfaces
export interface EstatisticasGerais {
  total: number;
  enviados: number;
  pendentes: number;
  vencidos: number;
}

export interface EstatisticaMensal {
  mes: string;
  mesFormatado: string;
  total: number;
  enviados: number;
  pendentes: number;
}

// Get general statistics
export async function buscarEstatisticasGerais(): Promise<{ data: EstatisticasGerais | null; error: string | null }> {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from("lembretes_anuais")
      .select("lembrete_enviado, data_proximo_lembrete");

    if (error) throw error;

    const total = data?.length || 0;
    const enviados = data?.filter(l => l.lembrete_enviado).length || 0;
    const pendentes = data?.filter(l => !l.lembrete_enviado).length || 0;
    const vencidos = data?.filter(l => !l.lembrete_enviado && l.data_proximo_lembrete && l.data_proximo_lembrete <= hoje).length || 0;

    return { 
      data: { total, enviados, pendentes, vencidos }, 
      error: null 
    };
  } catch (error: any) {
    console.error("Erro ao buscar estatísticas gerais:", error);
    return { data: null, error: error.message };
  }
}

// Get monthly statistics grouped by data_proximo_lembrete
export async function buscarEstatisticasPorMes(): Promise<{ data: EstatisticaMensal[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("lembretes_anuais")
      .select("lembrete_enviado, data_proximo_lembrete")
      .not("data_proximo_lembrete", "is", null);

    if (error) throw error;

    // Group by month
    const porMes: Record<string, { total: number; enviados: number; pendentes: number }> = {};

    data?.forEach(lembrete => {
      if (!lembrete.data_proximo_lembrete) return;
      
      const mesKey = lembrete.data_proximo_lembrete.substring(0, 7); // "2026-01"
      
      if (!porMes[mesKey]) {
        porMes[mesKey] = { total: 0, enviados: 0, pendentes: 0 };
      }
      
      porMes[mesKey].total++;
      if (lembrete.lembrete_enviado) {
        porMes[mesKey].enviados++;
      } else {
        porMes[mesKey].pendentes++;
      }
    });

    // Convert to array and format
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    const resultado = Object.entries(porMes)
      .map(([mes, stats]) => {
        const [ano, mesNum] = mes.split('-');
        const mesIndex = parseInt(mesNum, 10) - 1;
        return {
          mes,
          mesFormatado: `${meses[mesIndex]}/${ano}`,
          ...stats
        };
      })
      .sort((a, b) => a.mes.localeCompare(b.mes));

    return { data: resultado, error: null };
  } catch (error: any) {
    console.error("Erro ao buscar estatísticas por mês:", error);
    return { data: null, error: error.message };
  }
}