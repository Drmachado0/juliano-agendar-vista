// Rev-4.1 — Resolvedor determinístico de estado_atendimento para cards
// que estavam em "humano" / "aguardando_humano" e voltam para o funil
// automático (ex.: pivô de exame tabelado no HGP mantendo bot_ativo=true).
//
// Regras:
//   - nunca retornar "humano" nem "aguardando_humano"
//   - nunca retornar "coleta" (não é estado válido do funil)
//   - se falta nome_completo válido            → coletando_nome
//   - se tem nome mas falta data_nascimento    → coletando_data_nascimento
//   - se tem nome+nascimento e falta tipo      → coletando_tipo_atendimento
//   - se tem tudo acima e falta local          → coletando_local
//   - caso contrário                           → oferecendo_datas
//
// Preserva estados já válidos e não-humanos (idempotente).

const ESTADOS_VALIDOS = new Set<string>([
  "coletando_nome",
  "coletando_data_nascimento",
  "coletando_tipo_atendimento",
  "coletando_convenio",
  "coletando_local",
  "oferecendo_datas",
  "oferecendo_horarios",
  "aguardando_confirmacao",
  "confirmado",
]);

const ESTADOS_HUMANO = new Set<string>(["humano", "aguardando_humano", "coleta", ""]);

export interface EstadoResolverInput {
  estado_atual: string | null | undefined;
  nome_completo: string | null | undefined;
  data_nascimento: string | null | undefined;
  tipo_atendimento?: string | null | undefined;
  local_atendimento?: string | null | undefined;
}

function nomeValido(n: string | null | undefined): boolean {
  const s = (n || "").trim();
  if (s.length < 2) return false;
  // pelo menos uma letra pt-BR
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s);
}

/** Retorna o próximo estado válido do funil quando o card sai de humano
 *  para bot ativo. Se o estado atual já é válido e não-humano, mantém. */
export function resolveNextEstadoAtendimento(input: EstadoResolverInput): string {
  const atual = (input.estado_atual || "").trim().toLowerCase();

  // Preserva estados já válidos e não-humanos (idempotente).
  if (ESTADOS_VALIDOS.has(atual) && !ESTADOS_HUMANO.has(atual)) {
    return atual;
  }

  if (!nomeValido(input.nome_completo)) return "coletando_nome";

  const nasc = (input.data_nascimento || "").trim();
  if (!nasc) return "coletando_data_nascimento";

  const tipo = (input.tipo_atendimento || "").trim();
  if (!tipo) return "coletando_tipo_atendimento";

  const local = (input.local_atendimento || "").trim();
  if (!local) return "coletando_local";

  return "oferecendo_datas";
}

/** True se o estado indica handoff humano ou é inválido/desconhecido
 *  a ponto de exigir recomputo. */
export function precisaRecomputar(estadoAtual: string | null | undefined): boolean {
  const s = (estadoAtual || "").trim().toLowerCase();
  if (!s) return true;
  if (ESTADOS_HUMANO.has(s)) return true;
  return !ESTADOS_VALIDOS.has(s);
}
