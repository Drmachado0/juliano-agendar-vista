import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LiveStatus = 'CONNECTING' | 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT';

/**
 * Status-only realtime channel para o indicador "ao vivo" do CRM.
 *
 * ⚠️ Antes este hook duplicava as inscrições `postgres_changes` já feitas
 * em `CRM.tsx` (que faz o refetch debounced). Isso gerava 2 canais
 * escutando as mesmas tabelas e filtros redundantes no realtime server.
 *
 * Agora apenas abre um canal leve para expor o status da conexão;
 * a invalidação/refetch fica na origem única em `CRM.tsx`.
 */
export function useCrmKanbanLive() {
  const [status, setStatus] = useState<LiveStatus>('CONNECTING');

  useEffect(() => {
    const ch = supabase
      .channel('crm-kanban-status')
      .subscribe((s) => setStatus(s as LiveStatus));

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return status;
}
