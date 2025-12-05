import { supabase } from "@/integrations/supabase/client";

export interface Clinica {
  id: string;
  nome: string;
  slug: string;
  endereco: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export async function listarClinicas(): Promise<{ data: Clinica[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('clinicas')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;

    return { data: data as Clinica[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar clínicas:', err);
    return { data: [], error: err };
  }
}

export async function buscarClinica(id: string): Promise<{ data: Clinica | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('clinicas')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return { data: data as Clinica | null, error: null };
  } catch (err: any) {
    console.error('Erro ao buscar clínica:', err);
    return { data: null, error: err };
  }
}

export async function buscarClinicaPorSlug(slug: string): Promise<{ data: Clinica | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('clinicas')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;

    return { data: data as Clinica | null, error: null };
  } catch (err: any) {
    console.error('Erro ao buscar clínica por slug:', err);
    return { data: null, error: err };
  }
}

// Mapeamento entre local_atendimento (texto) e clinica_id
export function mapearLocalParaClinicaSlug(localAtendimento: string): string | null {
  const mapping: Record<string, string> = {
    'Clinicor – Paragominas': 'clinicor',
    'Hospital Geral de Paragominas': 'hgp',
    'Belém (IOB / Vitria)': 'iob',
  };
  return mapping[localAtendimento] || null;
}

export async function listarTodasClinicas(): Promise<{ data: Clinica[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('clinicas')
      .select('*')
      .order('nome');

    if (error) throw error;

    return { data: data as Clinica[], error: null };
  } catch (err: any) {
    console.error('Erro ao listar todas clínicas:', err);
    return { data: [], error: err };
  }
}

export async function criarClinica(clinica: Omit<Clinica, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Clinica | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('clinicas')
      .insert(clinica)
      .select()
      .single();

    if (error) throw error;

    return { data: data as Clinica, error: null };
  } catch (err: any) {
    console.error('Erro ao criar clínica:', err);
    return { data: null, error: err };
  }
}

export async function atualizarClinica(id: string, clinica: Partial<Omit<Clinica, 'id' | 'created_at' | 'updated_at'>>): Promise<{ data: Clinica | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('clinicas')
      .update(clinica)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return { data: data as Clinica, error: null };
  } catch (err: any) {
    console.error('Erro ao atualizar clínica:', err);
    return { data: null, error: err };
  }
}
