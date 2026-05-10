import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type KanbanColuna =
  | 'NOVO LEAD'
  | 'PRECISA DE HUMANO'
  | 'AGUARDANDO'
  | 'CLINICOR'
  | 'HGP'
  | 'BELÉM'
  | 'ATENDIDO';

export type KanbanRow = {
  agendamento_id: string;
  nome: string;
  telefone: string;
  email: string | null;
  data_nascimento: string | null;
  tipo_atendimento: string | null;
  detalhe_exame_ou_cirurgia: string | null;
  unidade: string | null;
  convenio: string | null;
  convenio_outro: string | null;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  status_crm: string;
  status_funil: string | null;
  origem: string | null;
  confirmation_status: string | null;
  confirmacao_enviada: boolean | null;
  bot_ativo: boolean | null;
  bot_pausado_ate: string | null;
  is_sandbox: boolean | null;
  sandbox_reason: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  landing_page: string | null;
  referrer: string | null;
  clinica_id: string | null;
  profissional_id: string | null;
  servico_id: string | null;
  clinica_nome: string | null;
  servico_nome: string | null;
  profissional_nome: string | null;
  valor_convenio: number | null;
  total_mensagens: number;
  ultima_msg: string | null;
  ultima_msg_direcao: string | null;
  ultima_msg_at: string | null;
  ultima_msg_lida: boolean | null;
  created_at: string;
  updated_at: string;
  coluna_kanban: KanbanColuna;
};

export function useCrmKanban(opts: { incluirSandbox: boolean }) {
  return useQuery({
    queryKey: ['vw_crm_kanban', opts.incluirSandbox],
    queryFn: async () => {
      const view = opts.incluirSandbox ? 'vw_crm_kanban_all' : 'vw_crm_kanban';
      const { data, error } = await supabase
        .from(view as any)
        .select('*')
        .order('data_agendamento', { ascending: true, nullsFirst: false })
        .order('hora_agendamento', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as KanbanRow[];
    },
    staleTime: 30_000,
  });
}
