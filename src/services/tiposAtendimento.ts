import { supabase } from "@/integrations/supabase/client";

export interface TipoAtendimento {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export async function listarTiposAtendimento(): Promise<{ data: TipoAtendimento[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('tipos_atendimento')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;

    return { data: data as TipoAtendimento[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar tipos de atendimento:', err);
    return { data: [], error: err };
  }
}

export async function listarTodosTiposAtendimento(): Promise<{ data: TipoAtendimento[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('tipos_atendimento')
      .select('*')
      .order('nome');

    if (error) throw error;

    return { data: data as TipoAtendimento[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar todos tipos de atendimento:', err);
    return { data: [], error: err };
  }
}

export async function criarTipoAtendimento(tipo: Omit<TipoAtendimento, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: TipoAtendimento | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('tipos_atendimento')
      .insert(tipo)
      .select()
      .single();

    if (error) throw error;

    return { data: data as TipoAtendimento, error: null };
  } catch (err: any) {
    console.error('Erro ao criar tipo de atendimento:', err);
    return { data: null, error: err };
  }
}

export async function atualizarTipoAtendimento(id: string, tipo: Partial<Omit<TipoAtendimento, 'id' | 'created_at' | 'updated_at'>>): Promise<{ data: TipoAtendimento | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('tipos_atendimento')
      .update(tipo)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { data: data as TipoAtendimento, error: null };
  } catch (err: any) {
    console.error('Erro ao atualizar tipo de atendimento:', err);
    return { data: null, error: err };
  }
}
