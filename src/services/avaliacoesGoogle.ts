import { getSupabase } from "@/integrations/supabase/lazy";
import { MAX_TESTIMONIALS } from "@/lib/constants";

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
  TETO DE LINHAS. A sincronizacao diaria faz esta tabela crescer de proposito, e
  o backfill do Maps trouxe as 111 de uma vez. Sem limite, cada visita a home e a
  cada uma das 12 paginas de procedimento baixaria a tabela inteira.

  A folga sobre o teto do mural existe porque a deduplicacao acontece depois, no
  cliente, e pode colapsar linhas. Baixar exatamente o teto arriscaria entregar
  menos avaliacoes do que o mural aguenta mostrar.
*/
const MAX_LINHAS = MAX_TESTIMONIALS + 20;

/**
 * Busca as avaliacoes ativas do Google gravadas no banco pela sincronizacao.
 *
 * REMOVIDA E REPOSTA NO MESMO DIA, 29/08/2026. A Fase 0 do ajuste de publicidade
 * medica tirou esta funcao junto com os carrosseis de depoimento. O medico
 * revisou a decisao horas depois e pediu os comentarios de volta na home, em
 * formato de prova social. A escolha e dele, esta registrada, e vale so para a
 * TestimonialsSection: /agendamento e /paragominas seguem sem depoimento.
 *
 * O QUE ESTA FUNCAO DEVOLVE E DADO PESSOAL de paciente, nome, foto e texto.
 * Quem consumir isso esta publicando depoimento identificado. Ver a nota no
 * topo de components/TestimonialsSection.tsx antes de criar um segundo
 * consumidor.
 */
export async function buscarAvaliacoesGoogle(): Promise<AvaliacaoGoogle[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('avaliacoes_google')
    .select('*')
    .eq('ativo', true)
    /*
      Sem texto nao entra no mural, e o backfill trouxe 44 assim. Filtrar aqui
      impede que ocupem as vagas do limite e empurrem as boas para fora.

      UM FILTRO SO, e nao dois. text <> '' ja descarta NULL, porque a comparacao
      devolve NULL e o WHERE trata isso como falso. Texto so de espaco ainda
      passa, e quem barra e o buildTestimonialPool.
    */
    .neq('text', '')
    /*
      nullsFirst false porque o padrao do Postgres em DESC e NULLS FIRST, e o JS
      ordena com `b.time_epoch || 0`, que joga nulo para o fim. Sem isso as duas
      pontas discordam: relToEpoch devolve null quando nao entende a data
      relativa, e essas linhas tomariam as primeiras vagas do limite para depois
      cair no fim do mural.
    */
    .order('time_epoch', { ascending: false, nullsFirst: false })
    .limit(MAX_LINHAS);

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
