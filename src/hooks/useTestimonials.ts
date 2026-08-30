import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buscarAvaliacoesGoogle } from "@/services/avaliacoesGoogle";
import { buildTestimonialPool, type TestimonialItem } from "@/lib/testimonialsPool";

export interface TestimonialsData {
  /** Avaliações já deduplicadas, ordenadas e sem as que não têm texto. */
  pool: TestimonialItem[];
  /** true enquanto a primeira busca está em voo. false enquanto a query está desligada. */
  isLoading: boolean;
}

/*
  POR QUE ESTE HOOK EXISTE. A configuração da query vivia dentro da
  TestimonialsSection, que renderiza na home e em 12 páginas de procedimento, e
  era cópia literal da que está em useGoogleReviews. Duas políticas de cache
  para o mesmo dado do Google, prontas para divergir na próxima edição.

  SEM refetchInterval, ao contrário do agregado. A tabela é escrita por um cron
  diário. Repetir a busca a cada 30 minutos numa aba aberta rendia 48 requisições
  por dia para um dado que muda uma vez. O staleTime longo mais o refetch ao
  voltar o foco já cobrem o visitante que retorna.
*/
const UMA_HORA = 1000 * 60 * 60;

/**
 * Pool de avaliações do Google para exibição.
 *
 * @param enabled deixe false enquanto a seção estiver fora da tela. O mural
 * fica bem abaixo da dobra em 13 rotas, e buscar no mount põe a requisição, mais
 * a cascata de avatares do Google, competindo com o carregamento inicial.
 */
export function useTestimonials(enabled = true): TestimonialsData {
  const { data, isLoading } = useQuery({
    queryKey: ["avaliacoes-google"],
    queryFn: buscarAvaliacoesGoogle,
    enabled,
    staleTime: UMA_HORA,
    refetchOnWindowFocus: true,
  });

  // useMemo pela identidade do array, não pelo custo: sem ele cada render devolve
  // um pool novo e qualquer memo do consumidor deixa de valer.
  const pool = useMemo(() => buildTestimonialPool(data ?? []), [data]);

  return { pool, isLoading };
}
