import { supabase } from "@/integrations/supabase/client";

export interface Servico {
  id: string;
  nome: string;
  duracao_min: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export async function listarServicos(): Promise<{ data: Servico[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;

    return { data: data as Servico[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar serviços:', err);
    return { data: [], error: err };
  }
}

export async function buscarServico(id: string): Promise<{ data: Servico | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return { data: data as Servico | null, error: null };
  } catch (err: any) {
    console.error('Erro ao buscar serviço:', err);
    return { data: null, error: err };
  }
}

export function getDuracaoPadrao(): number {
  return 30; // 30 minutos padrão
}

export async function listarTodosServicos(): Promise<{ data: Servico[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('servicos')
      .select('*')
      .order('nome');

    if (error) throw error;

    return { data: data as Servico[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar todos serviços:', err);
    return { data: [], error: err };
  }
}

export async function criarServico(servico: Omit<Servico, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Servico | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('servicos')
      .insert(servico)
      .select()
      .single();

    if (error) throw error;

    return { data: data as Servico, error: null };
  } catch (err: any) {
    console.error('Erro ao criar serviço:', err);
    return { data: null, error: err };
  }
}

export async function atualizarServico(id: string, servico: Partial<Omit<Servico, 'id' | 'created_at' | 'updated_at'>>): Promise<{ data: Servico | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('servicos')
      .update(servico)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { data: data as Servico, error: null };
  } catch (err: any) {
    console.error('Erro ao atualizar serviço:', err);
    return { data: null, error: err };
  }
}
