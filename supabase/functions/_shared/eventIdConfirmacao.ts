/**
 * Monta o `event_id` do disparo de confirmação enviado ao n8n.
 *
 * Por que existe: o valor era `${agendamentoId ?? 'sem_id'}:confirmacao_imediata`.
 * Quando não há agendamento (confirmação avulsa, por telefone), TODA chamada
 * produzia a mesma string literal `sem_id:confirmacao_imediata`. Qualquer
 * deduplicação por event_id — no n8n ou no ManyChat — passa a tratar o segundo
 * disparo em diante como repetição e o descarta em silêncio.
 *
 * Com agendamento o id continua estável de propósito: reenviar a confirmação do
 * mesmo agendamento DEVE ser reconhecido como o mesmo evento.
 *
 * `idAleatorio` é injetável só para o teste poder fixar o valor.
 */
export function montarEventIdConfirmacao(
  agendamentoId?: string | null,
  idAleatorio: () => string = () => crypto.randomUUID(),
): string {
  const base = (agendamentoId ?? "").trim();
  return base
    ? `${base}:confirmacao_imediata`
    : `sem_id:${idAleatorio()}:confirmacao_imediata`;
}
