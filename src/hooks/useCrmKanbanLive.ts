import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LiveStatus = 'CONNECTING' | 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT';

/**
 * Subscreve o canal Realtime do CRM Kanban e invalida a query
 * `vw_crm_kanban` sempre que houver mudança em agendamentos,
 * mensagens_whatsapp ou crm_audit_log.
 */
export function useCrmKanbanLive() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('CONNECTING');

  useEffect(() => {
    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ['vw_crm_kanban'] });

    const ch = supabase
      .channel('crm-kanban-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens_whatsapp' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_audit_log' }, invalidate)
      .subscribe((s) => setStatus(s as LiveStatus));

    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return status;
}
