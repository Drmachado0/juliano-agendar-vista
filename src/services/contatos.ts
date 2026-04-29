import { supabase } from "@/integrations/supabase/client";

export interface Contato {
  id: string; // agendamento_id principal
  nome_completo: string;
  telefone_whatsapp: string;
  email: string | null;
  data_nascimento: string | null;
  status_crm: string;
  local_atendimento: string | null;
  is_sandbox: boolean;
  total_agendamentos: number;
  ultima_interacao: string | null;
  created_at: string;
}

const normalize = (p: string) => (p || "").replace(/\D/g, "");

// Lista contatos únicos por telefone (escolhe o agendamento mais relevante por número)
export const listarContatos = async (
  termoBusca?: string,
  incluirSandbox: boolean = false
): Promise<{ data: Contato[]; error: Error | null }> => {
  try {
    let query = supabase
      .from("agendamentos")
      .select(
        "id, nome_completo, telefone_whatsapp, email, data_nascimento, status_crm, local_atendimento, is_sandbox, created_at, updated_at, data_agendamento"
      )
      .not("telefone_whatsapp", "is", null)
      .neq("telefone_whatsapp", "")
      .order("created_at", { ascending: false });

    if (!incluirSandbox) query = query.eq("is_sandbox", false);

    if (termoBusca && termoBusca.trim()) {
      query = query.or(
        `nome_completo.ilike.%${termoBusca}%,telefone_whatsapp.ilike.%${termoBusca}%,email.ilike.%${termoBusca}%`
      );
    }

    const { data, error } = await query.limit(1000);
    if (error) throw error;

    // Agrupa por telefone normalizado (últimos 10 dígitos)
    const grupos = new Map<string, any[]>();
    for (const ag of data || []) {
      const key = normalize(ag.telefone_whatsapp).slice(-10);
      if (!key) continue;
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key)!.push(ag);
    }

    const contatos: Contato[] = [];
    for (const [, lista] of grupos) {
      // Escolhe o "principal": não-sandbox > tem data agendada > mais recente
      lista.sort((a, b) => {
        if (a.is_sandbox !== b.is_sandbox) return a.is_sandbox ? 1 : -1;
        const aHas = a.data_agendamento ? 1 : 0;
        const bHas = b.data_agendamento ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime();
      });
      const principal = lista[0];
      contatos.push({
        id: principal.id,
        nome_completo: principal.nome_completo,
        telefone_whatsapp: principal.telefone_whatsapp,
        email: principal.email,
        data_nascimento: principal.data_nascimento,
        status_crm: principal.status_crm,
        local_atendimento: principal.local_atendimento,
        is_sandbox: !!principal.is_sandbox,
        total_agendamentos: lista.length,
        ultima_interacao: principal.updated_at || principal.created_at,
        created_at: principal.created_at,
      });
    }

    contatos.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
    return { data: contatos, error: null };
  } catch (error) {
    console.error("Erro ao listar contatos:", error);
    return { data: [], error: error as Error };
  }
};

export const atualizarContato = async (
  id: string,
  patch: { nome_completo?: string; telefone_whatsapp?: string; email?: string | null; data_nascimento?: string | null }
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.from("agendamentos").update(patch).eq("id", id);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error("Erro ao atualizar contato:", error);
    return { error: error as Error };
  }
};

// Apaga TODOS os agendamentos+mensagens daquele telefone (últimos 10 dígitos)
export const apagarContato = async (
  telefone: string
): Promise<{ removidos: number; error: Error | null }> => {
  try {
    const last10 = normalize(telefone).slice(-10);
    if (last10.length < 8) throw new Error("Telefone inválido");

    // Busca todos os agendamentos com esse telefone
    const { data: ags, error: e1 } = await supabase
      .from("agendamentos")
      .select("id, telefone_whatsapp");
    if (e1) throw e1;

    const ids = (ags || [])
      .filter((a: any) => normalize(a.telefone_whatsapp).slice(-10) === last10)
      .map((a: any) => a.id);

    if (ids.length === 0) return { removidos: 0, error: null };

    // Apaga mensagens vinculadas
    await supabase.from("mensagens_whatsapp").delete().in("agendamento_id", ids);
    // Apaga agendamentos
    const { error: e2 } = await supabase.from("agendamentos").delete().in("id", ids);
    if (e2) throw e2;

    return { removidos: ids.length, error: null };
  } catch (error) {
    console.error("Erro ao apagar contato:", error);
    return { removidos: 0, error: error as Error };
  }
};
