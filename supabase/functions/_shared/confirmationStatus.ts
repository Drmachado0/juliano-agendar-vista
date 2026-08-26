// ============================================================================
// confirmationStatus.ts
// Vocabulário único de `agendamentos.confirmation_status`.
//
// Por que existe: a coluna tem uma CHECK constraint no banco
// (`check_confirmation_status`, migration 20251206021728) que aceita apenas os
// cinco valores abaixo. O código foi divergindo dela em silêncio:
//
//   - `n8n-resposta-confirmacao` gravava "confirmado_paciente" e
//     "cancelado_paciente". Nenhum dos dois passa na constraint, entao o UPDATE
//     falhava, o erro era so logado e a funcao respondia ok:true. Ou seja: o
//     paciente respondia "Confirmar" ou "Cancelar" no WhatsApp e nada mudava.
//   - `confirmar-agendamento-whatsapp` gravava "bloqueado_nome_invalido", que
//     tambem nao passa.
//   - `lembrete-consulta-whatsapp` e `status-agendamento` comparavam com
//     "confirmado" e "cancelado" — o primeiro nunca casava porque o valor nunca
//     era gravado, o segundo nao existe no vocabulario.
//
// Módulo puro, sem Deno nem Supabase, para o teste conseguir comparar esta
// lista com a constraint real lida do arquivo de migration.
// ============================================================================

export const CONFIRMATION_STATUS = {
  /** Ainda não tentamos enviar a confirmação. É o DEFAULT da coluna. */
  NAO_ENVIADO: "nao_enviado",
  /** Confirmação enviada; esperando o paciente responder. */
  AGUARDANDO_CONFIRMACAO: "aguardando_confirmacao",
  /** O paciente confirmou presença. */
  CONFIRMADO: "confirmado",
  /** O paciente cancelou. */
  CANCELADO_PELO_PACIENTE: "cancelado_pelo_paciente",
  /** Não conseguimos entregar a confirmação. */
  FALHA_ENVIO: "falha_envio",
} as const;

export type ConfirmationStatus =
  (typeof CONFIRMATION_STATUS)[keyof typeof CONFIRMATION_STATUS];

/** Exatamente os valores aceitos pela CHECK constraint do banco. */
export const CONFIRMATION_STATUS_VALIDOS: readonly string[] =
  Object.values(CONFIRMATION_STATUS);

export function ehConfirmationStatusValido(valor?: string | null): boolean {
  return CONFIRMATION_STATUS_VALIDOS.includes(String(valor ?? ""));
}

/**
 * True quando o paciente já respondeu — confirmando ou cancelando.
 *
 * Quem já respondeu não deve receber o lembrete de véspera: para quem
 * confirmou é redundante, e para quem cancelou é um erro constrangedor.
 */
export function pacienteJaRespondeu(status?: string | null): boolean {
  return (
    status === CONFIRMATION_STATUS.CONFIRMADO ||
    status === CONFIRMATION_STATUS.CANCELADO_PELO_PACIENTE
  );
}
