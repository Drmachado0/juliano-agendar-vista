import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clinica } from "@/services/clinicas";

export type TipoBloqueio = 'dia_inteiro' | 'intervalo' | 'ausencia_profissional' | 'feriado';

export interface Bloqueio {
  id: string;
  clinica_id: string;
  profissional_id: string | null;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  tipo_bloqueio: TipoBloqueio;
  motivo: string | null;
  created_at: string;
  updated_at: string;
  clinicas?: Clinica;
}

export interface BloqueioInsert {
  clinica_id: string;
  profissional_id?: string | null;
  data: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  tipo_bloqueio: TipoBloqueio;
  motivo?: string | null;
}

async function fetchBloqueios(
  clinicaId: string,
  dataInicio: string,
  dataFim: string
): Promise<Bloqueio[]> {
  const { data, error } = await supabase
    .from('bloqueios_agenda')
    .select('*, clinicas(nome)')
    .eq('clinica_id', clinicaId)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: true });

  if (error) throw error;
  return data as Bloqueio[];
}

async function createBloqueio(bloqueio: BloqueioInsert): Promise<Bloqueio> {
  const { data, error } = await supabase
    .from('bloqueios_agenda')
    .insert(bloqueio)
    .select()
    .single();

  if (error) throw error;
  return data as Bloqueio;
}

async function updateBloqueio(
  id: string,
  dados: Partial<BloqueioInsert>
): Promise<void> {
  const { error } = await supabase
    .from('bloqueios_agenda')
    .update(dados)
    .eq('id', id);

  if (error) throw error;
}

async function deleteBloqueio(id: string): Promise<void> {
  const { error } = await supabase
    .from('bloqueios_agenda')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function useBloqueios(
  clinicaId: string | null,
  dataInicio: string,
  dataFim: string
) {
  const queryClient = useQueryClient();
  
  const queryKey = ["bloqueios", clinicaId, dataInicio, dataFim];

  const {
    data: bloqueios = [],
    isLoading: loading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey,
    queryFn: () => fetchBloqueios(clinicaId!, dataInicio, dataFim),
    enabled: !!clinicaId && !!dataInicio && !!dataFim,
    staleTime: 0, // Always fetch fresh data when clinic changes
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const createMutation = useMutation({
    mutationFn: createBloqueio,
    onMutate: async (newBloqueio) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });
      
      // Snapshot previous value
      const previousBloqueios = queryClient.getQueryData<Bloqueio[]>(queryKey);
      
      // Optimistically add to list
      if (previousBloqueios) {
        const optimisticBloqueio: Bloqueio = {
          ...newBloqueio,
          id: `temp-${Date.now()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          hora_inicio: newBloqueio.hora_inicio || null,
          hora_fim: newBloqueio.hora_fim || null,
          profissional_id: newBloqueio.profissional_id || null,
          motivo: newBloqueio.motivo || null,
          tipo_bloqueio: newBloqueio.tipo_bloqueio,
        };
        queryClient.setQueryData<Bloqueio[]>(queryKey, [
          ...previousBloqueios,
          optimisticBloqueio,
        ]);
      }
      
      return { previousBloqueios };
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.previousBloqueios) {
        queryClient.setQueryData(queryKey, context.previousBloqueios);
      }
      toast.error('Erro ao criar bloqueio');
    },
    onSuccess: () => {
      toast.success('Bloqueio criado com sucesso');
    },
    onSettled: () => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dados }: { id: string; dados: Partial<BloqueioInsert> }) =>
      updateBloqueio(id, dados),
    onMutate: async ({ id, dados }) => {
      await queryClient.cancelQueries({ queryKey });
      
      const previousBloqueios = queryClient.getQueryData<Bloqueio[]>(queryKey);
      
      if (previousBloqueios) {
        queryClient.setQueryData<Bloqueio[]>(
          queryKey,
          previousBloqueios.map((b) =>
            b.id === id ? { ...b, ...dados } : b
          )
        );
      }
      
      return { previousBloqueios };
    },
    onError: (err, _, context) => {
      if (context?.previousBloqueios) {
        queryClient.setQueryData(queryKey, context.previousBloqueios);
      }
      toast.error('Erro ao atualizar bloqueio');
    },
    onSuccess: () => {
      toast.success('Bloqueio atualizado');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBloqueio,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      
      const previousBloqueios = queryClient.getQueryData<Bloqueio[]>(queryKey);
      
      if (previousBloqueios) {
        queryClient.setQueryData<Bloqueio[]>(
          queryKey,
          previousBloqueios.filter((b) => b.id !== id)
        );
      }
      
      return { previousBloqueios };
    },
    onError: (err, _, context) => {
      if (context?.previousBloqueios) {
        queryClient.setQueryData(queryKey, context.previousBloqueios);
      }
      toast.error('Erro ao remover bloqueio');
    },
    onSuccess: () => {
      toast.success('Bloqueio removido');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    bloqueios,
    loading: loading || isFetching,
    refetch,
    create: createMutation.mutateAsync,
    update: (id: string, dados: Partial<BloqueioInsert>) =>
      updateMutation.mutateAsync({ id, dados }),
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function getTipoBloqueioLabel(tipo: TipoBloqueio): string {
  const labels: Record<TipoBloqueio, string> = {
    'dia_inteiro': 'Dia Inteiro',
    'intervalo': 'Intervalo',
    'ausencia_profissional': 'Ausência de Profissional',
    'feriado': 'Feriado',
  };
  return labels[tipo] || tipo;
}

export function getTipoBloqueioColor(tipo: TipoBloqueio): string {
  const colors: Record<TipoBloqueio, string> = {
    'dia_inteiro': 'bg-red-100 text-red-800 border-red-200',
    'intervalo': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'ausencia_profissional': 'bg-gray-100 text-gray-800 border-gray-200',
    'feriado': 'bg-orange-100 text-orange-800 border-orange-200',
  };
  return colors[tipo] || 'bg-gray-100 text-gray-800';
}
