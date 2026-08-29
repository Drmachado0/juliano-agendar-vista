import { getSupabase } from "@/integrations/supabase/lazy";

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

/*
  A funcao buscarAvaliacoesGoogle foi removida em 29/08/2026.

  Ela lia a tabela avaliacoes_google, que guarda nome e texto de paciente, e
  alimentava os carrosseis de depoimento da home, de /agendamento e de
  /paragominas. Esses carrosseis sairam por decisao do medico, ver a Fase 0 do
  plano de acao, e a funcao ficou sem consumidor.

  O ARQUIVO CONTINUA porque sincronizarAvaliacoesManualmente segue em uso na
  tela de admin, em pages/admin/Configuracoes.tsx. A sincronizacao ainda grava
  as avaliacoes no banco, o que alimenta o total e a nota que o site exibe de
  forma agregada.

  QUESTAO EM ABERTO para o medico: se o site nao exibe mais texto de avaliacao,
  vale continuar gravando o texto e o nome no banco, ou basta guardar o total e
  a nota? Guardar menos dado pessoal e melhor por padrao.

  O tipo AvaliacaoGoogle acima descreve o que a sincronizacao grava, e por isso
  fica.
*/

/**
 * Sincroniza manualmente as avaliações do Google (apenas para admins)
 */
export async function sincronizarAvaliacoesManualmente(): Promise<{
  success: boolean;
  message: string;
  synced?: number;
  errors?: number;
}> {
  const supabase = await getSupabase();
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
  const supabase = await getSupabase();
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
