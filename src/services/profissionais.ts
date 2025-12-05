import { supabase } from "@/integrations/supabase/client";

export interface Profissional {
  id: string;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfissionalClinica {
  id: string;
  profissional_id: string;
  clinica_id: string;
  created_at: string;
}

export async function listarProfissionais(): Promise<{ data: Profissional[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;

    return { data: data as Profissional[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar profissionais:', err);
    return { data: [], error: err };
  }
}

export async function buscarProfissional(id: string): Promise<{ data: Profissional | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profissionais')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return { data: data as Profissional | null, error: null };
  } catch (err: any) {
    console.error('Erro ao buscar profissional:', err);
    return { data: null, error: err };
  }
}

export async function listarProfissionaisPorClinica(clinicaId: string): Promise<{ data: Profissional[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('profissional_clinica')
      .select(`
        profissional_id,
        profissionais (*)
      `)
      .eq('clinica_id', clinicaId);

    if (error) throw error;

    const profissionais = data
      ?.map((item: any) => item.profissionais)
      .filter((p: any) => p && p.ativo) || [];

    return { data: profissionais as Profissional[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar profissionais por clínica:', err);
    return { data: [], error: err };
  }
}

export async function vincularProfissionalClinica(
  profissionalId: string,
  clinicaId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('profissional_clinica')
      .insert({ profissional_id: profissionalId, clinica_id: clinicaId });

    if (error) throw error;

    return { error: null };
  } catch (err: any) {
    console.error('Erro ao vincular profissional:', err);
    return { error: err };
  }
}
