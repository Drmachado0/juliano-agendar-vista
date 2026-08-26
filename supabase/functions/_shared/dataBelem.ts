// ============================================================================
// dataBelem.ts
// Data civil em America/Belem (UTC-3, sem horário de verão).
//
// Por que existe: as edge functions rodam em UTC. Depois das 21:00 de Belém já
// é o dia seguinte em UTC, então quem calculava "amanhã" com `new Date()` e
// `setDate(+1)` pulava um dia inteiro: o lembrete de véspera iria para o dia
// errado e o paciente que consulta amanhã não receberia nada.
//
// Módulo puro, sem Deno nem Supabase, para dar para testar sem deployar.
// O mesmo raciocínio já existia embutido em `lembretes-runner` (nowInBelem);
// aqui ele vira uma peça só, compartilhada.
// ============================================================================

/** America/Belem é UTC-3 o ano inteiro — o Pará não adota horário de verão. */
const OFFSET_BELEM_MS = 3 * 60 * 60 * 1000;

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Data civil de hoje em Belém, no formato AAAA-MM-DD. */
export function dataCivilBelem(agora: Date = new Date()): string {
  return new Date(agora.getTime() - OFFSET_BELEM_MS).toISOString().slice(0, 10);
}

/** Data civil de amanhã em Belém, no formato AAAA-MM-DD. */
export function dataAmanhaBelem(agora: Date = new Date()): string {
  return new Date(agora.getTime() - OFFSET_BELEM_MS + UM_DIA_MS)
    .toISOString()
    .slice(0, 10);
}
