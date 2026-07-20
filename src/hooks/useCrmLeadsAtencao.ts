import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LeadAtencaoCategoria = 'lead_sem_welcome' | 'inbound_sem_resposta';

export type LeadAtencao = {
  agendamento_id: string;
  nome: string | null;
  telefone: string | null;
  status_crm: string | null;
  status_funil: string | null;
  bot_ativo: boolean | null;
  bot_pausado_ate: string | null;
  origem: string | null;
  created_at: string;
  ultima_in_at: string | null;
  ultima_out_at: string | null;
  categoria: LeadAtencaoCategoria;
  horas_desde_criacao: number | null;
  horas_desde_ultima_in: number | null;
};

// Lê a view vw_crm_leads_atencao (leads sem boas-vindas / paciente sem resposta).
// Tolerante a erro: se a view ainda não existir no banco (migration não aplicada),
// devolve lista vazia em vez de quebrar o board.
export function useCrmLeadsAtencao() {
  return useQuery({
    queryKey: ['vw_crm_leads_atencao'],
    queryFn: async () => {
      const { data, error } = await supabase
        // View fora dos tipos gerados do Supabase (mesmo padrão do useCrmKanban).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('vw_crm_leads_atencao' as any)
        .select('*');
      if (error) {
        console.warn('[useCrmLeadsAtencao] view indisponível:', error.message);
        return [] as LeadAtencao[];
      }
      return (data ?? []) as unknown as LeadAtencao[];
    },
    staleTime: 30_000,
  });
}
