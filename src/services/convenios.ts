import { supabase } from "@/integrations/supabase/client";

export interface Convenio {
  id: string;
  nome: string;
  slug: string;
  valor_consulta: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export async function listarConvenios(): Promise<{ data: Convenio[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('convenios')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;

    return { data: data as Convenio[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar convênios:', err);
    return { data: [], error: err };
  }
}

export async function listarTodosConvenios(): Promise<{ data: Convenio[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('convenios')
      .select('*')
      .order('nome');

    if (error) throw error;

    return { data: data as Convenio[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar todos convênios:', err);
    return { data: [], error: err };
  }
}

export async function criarConvenio(convenio: Omit<Convenio, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Convenio | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('convenios')
      .insert(convenio)
      .select()
      .single();

    if (error) throw error;

    return { data: data as Convenio, error: null };
  } catch (err: any) {
    console.error('Erro ao criar convênio:', err);
    return { data: null, error: err };
  }
}

export async function atualizarConvenio(id: string, convenio: Partial<Omit<Convenio, 'id' | 'created_at' | 'updated_at'>>): Promise<{ data: Convenio | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('convenios')
      .update(convenio)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { data: data as Convenio, error: null };
  } catch (err: any) {
    console.error('Erro ao atualizar convênio:', err);
    return { data: null, error: err };
  }
}
