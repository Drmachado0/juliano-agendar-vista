import { supabase } from "@/integrations/supabase/client";

export interface AvaliacaoGoogle {
  id: string;
  google_review_id: string;
  author_name: string;
  author_photo_url: string | null;
  rating: number;
  text: string | null;
  relative_time_description: string | null;
  time_epoch: number | null;
  language: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Busca avaliações ativas do Google armazenadas no banco
 */
export async function buscarAvaliacoesGoogle(): Promise<AvaliacaoGoogle[]> {
  const { data, error } = await supabase
    .from('avaliacoes_google')
    .select('*')
    .eq('ativo', true)
    .order('time_epoch', { ascending: false });

  if (error) {
    console.error('Erro ao buscar avaliações do Google:', error);
    return [];
  }

  return data || [];
}

/**
 * Sincroniza manualmente as avaliações do Google (apenas para admins)
 */
export async function sincronizarAvaliacoesManualmente(): Promise<{
  success: boolean;
  message: string;
  synced?: number;
  errors?: number;
}> {
  const { data, error } = await supabase.functions.invoke('sincronizar-avaliacoes-google');

  if (error) {
    console.error('Erro ao sincronizar avaliações:', error);
    return {
      success: false,
      message: error.message || 'Erro ao sincronizar avaliações',
    };
  }

  return data;
}

/**
 * Alterna o status ativo de uma avaliação (apenas para admins)
 */
export async function toggleAvaliacaoAtiva(id: string, ativo: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('avaliacoes_google')
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar avaliação:', error);
    return false;
  }

  return true;
}
