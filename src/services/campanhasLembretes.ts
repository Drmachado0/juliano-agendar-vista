import { supabase } from "@/integrations/supabase/client";
import type { LembreteAnual } from "./lembretesAnuais";
import { listarJanelasMes } from "./janelasAtendimento";

export type StatusRemessa =
  | "agendada"
  | "disponivel"
  | "em_andamento"
  | "concluida"
  | "concluida_com_falhas"
  | "cancelada"
  | "bloqueada_por_limite"
  | "pendente";

export type StatusPaciente =
  | "pendente"
  | "enviando"
  | "enviado"
  | "falha"
  | "ignorado"
  | "cancelado"
  | "bloqueado_por_limite";

export interface CampanhaRow {
  id: string;
  ano_referencia: number;
  mes_referencia: number;
  status: string;
  total_elegivel: number;
  total_enviados: number;
  total_falhas: number;
  total_ignorados: number;
  inconsistencias: number;
  gerada_em: string;
  concluida_em: string | null;
}

export interface RemessaRow {
  id: string;
  campanha_id: string;
  numero_remessa: number;
  data_programada: string;
  status: StatusRemessa;
  quantidade_planejada: number;
  processados: number;
  enviados: number;
  falhas: number;
  ignorados: number;
  motivo_bloqueio: string | null;
  inicio_em: string | null;
  fim_em: string | null;
}

export interface PacienteCampanhaRow {
  id: string;
  campanha_id: string;
  remessa_id: string;
  numero_remessa: number;
  lembrete_id: string;
  nome: string;
  telefone: string;
  primeiro_nome: string | null;
  data_ultima_consulta: string | null;
  inconsistente_data: boolean;
  status: StatusPaciente;
  motivo_falha: string | null;
  motivo_ignorado: string | null;
  ultimo_envio_em: string | null;
}

// DIAS_REMESSAS removido — agora as remessas são derivadas de janelas_atendimento_lembretes

export async function buscarCampanha(ano: number, mes1a12: number) {
  const { data, error } = await supabase
    .from("lembretes_campanhas" as any)
    .select("*")
    .eq("ano_referencia", ano)
    .eq("mes_referencia", mes1a12)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CampanhaRow | null;
}

export async function buscarRemessasComPacientes(campanhaId: string) {
  const [remessasRes, pacientesRes] = await Promise.all([
    supabase
      .from("lembretes_campanha_remessas" as any)
      .select("*")
      .eq("campanha_id", campanhaId)
      .order("numero_remessa"),
    supabase
      .from("lembretes_campanha_pacientes" as any)
      .select("*")
      .eq("campanha_id", campanhaId),
  ]);
  if (remessasRes.error) throw remessasRes.error;
  if (pacientesRes.error) throw pacientesRes.error;
  return {
    remessas: (remessasRes.data || []) as unknown as RemessaRow[],
    pacientes: (pacientesRes.data || []) as unknown as PacienteCampanhaRow[],
  };
}

function dividirEmRemessas(total: number, n = 4): number[] {
  const base = Math.floor(total / n);
  const resto = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

interface CriarPlanoArgs {
  ano: number;
  mes1a12: number; // 1..12
  pacientes: Array<LembreteAnual & { inconsistente_data?: boolean }>;
  quantidades?: number[]; // override modo manual; senão divisão balanceada (length deve corresponder ao número de janelas)
}

/**
 * Congela um plano de campanha. Se já existir uma campanha para o mês, lança erro.
 * Requer pelo menos 1 janela de atendimento cadastrada para o mês.
 * Cada janela vira UMA remessa (numero_remessa = numero_janela).
 */
export async function criarPlanoCampanha({ ano, mes1a12, pacientes, quantidades }: CriarPlanoArgs) {
  const existente = await buscarCampanha(ano, mes1a12);
  if (existente) {
    throw new Error("Já existe uma campanha para este mês. Exclua-a antes de gerar um novo plano.");
  }

  const janelas = await listarJanelasMes(ano, mes1a12);
  if (janelas.length === 0) {
    throw new Error(
      "Cadastre pelo menos uma janela de atendimento para o mês antes de gerar a campanha.",
    );
  }

  // Ordenação canônica dos pacientes (data_proximo_lembrete asc, created_at asc, nome asc)
  const ordenados = [...pacientes].sort((a, b) => {
    const dA = a.data_proximo_lembrete || "9999-12-31";
    const dB = b.data_proximo_lembrete || "9999-12-31";
    if (dA !== dB) return dA < dB ? -1 : 1;
    const cA = a.created_at || "";
    const cB = b.created_at || "";
    if (cA !== cB) return cA < cB ? -1 : 1;
    return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
  });

  const tamanhos =
    quantidades && quantidades.length === janelas.length
      ? quantidades
      : dividirEmRemessas(ordenados.length, janelas.length);

  const inconsistencias = ordenados.filter((p) => p.inconsistente_data).length;

  const { data: campanha, error: e1 } = await supabase
    .from("lembretes_campanhas" as any)
    .insert({
      ano_referencia: ano,
      mes_referencia: mes1a12,
      status: "planejada",
      total_elegivel: ordenados.length,
      inconsistencias,
    })
    .select()
    .single();
  if (e1) throw e1;

  const camp = campanha as unknown as CampanhaRow;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const remessasInsert = janelas.map((j) => {
    const dataProg = new Date(j.data_envio_sugerida + "T00:00:00");
    let status: StatusRemessa = "agendada";
    if (dataProg <= hoje) status = "disponivel";
    return {
      campanha_id: camp.id,
      numero_remessa: j.numero_janela,
      data_programada: j.data_envio_sugerida,
      janela_atendimento_id: j.id,
      status,
      quantidade_planejada: tamanhos[j.numero_janela - 1] || 0,
    };
  });

  const { data: remessas, error: e2 } = await supabase
    .from("lembretes_campanha_remessas" as any)
    .insert(remessasInsert)
    .select();
  if (e2) throw e2;

  const remessasRows = (remessas as unknown as RemessaRow[]).sort(
    (a, b) => a.numero_remessa - b.numero_remessa,
  );

  // Distribui pacientes nas janelas (ordem canônica → fatias por tamanho)
  let cursor = 0;
  const pacientesInsert: Array<Partial<PacienteCampanhaRow>> = [];
  for (const r of remessasRows) {
    const qtd = tamanhos[r.numero_remessa - 1] || 0;
    const slice = ordenados.slice(cursor, cursor + qtd);
    cursor += qtd;
    for (const p of slice) {
      pacientesInsert.push({
        campanha_id: camp.id,
        remessa_id: r.id,
        numero_remessa: r.numero_remessa,
        lembrete_id: p.id,
        nome: p.nome,
        telefone: p.telefone,
        primeiro_nome: p.primeiro_nome,
        data_ultima_consulta: p.data_ultima_consulta,
        inconsistente_data: !!p.inconsistente_data,
        status: "pendente",
      });
    }
  }

  if (pacientesInsert.length > 0) {
    const { error: e3 } = await supabase
      .from("lembretes_campanha_pacientes" as any)
      .insert(pacientesInsert as any);
    if (e3) throw e3;
  }

  return camp;
}

export async function excluirCampanha(campanhaId: string) {
  const { error } = await supabase
    .from("lembretes_campanhas" as any)
    .delete()
    .eq("id", campanhaId);
  if (error) throw error;
}

export async function atualizarStatusRemessa(
  remessaId: string,
  fields: Partial<RemessaRow>,
) {
  const { error } = await supabase
    .from("lembretes_campanha_remessas" as any)
    .update(fields as any)
    .eq("id", remessaId);
  if (error) throw error;
}

export async function atualizarPacienteCampanha(
  pacienteId: string,
  fields: Partial<PacienteCampanhaRow>,
) {
  const { error } = await supabase
    .from("lembretes_campanha_pacientes" as any)
    .update(fields as any)
    .eq("id", pacienteId);
  if (error) throw error;
}

export async function atualizarTotaisCampanha(campanhaId: string) {
  const { data, error } = await supabase
    .from("lembretes_campanha_pacientes" as any)
    .select("status")
    .eq("campanha_id", campanhaId);
  if (error) throw error;
  const rows = (data || []) as unknown as Array<{ status: StatusPaciente }>;
  const enviados = rows.filter((r) => r.status === "enviado").length;
  const falhas = rows.filter((r) => r.status === "falha").length;
  const ignorados = rows.filter((r) => r.status === "ignorado").length;

  await supabase
    .from("lembretes_campanhas" as any)
    .update({
      total_enviados: enviados,
      total_falhas: falhas,
      total_ignorados: ignorados,
    } as any)
    .eq("id", campanhaId);
}

/** Conta envios de pacientes da campanha (via mensagens_whatsapp) feitos hoje pelo operador. */
export async function contarEnviosHoje(): Promise<number> {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("mensagens_whatsapp")
    .select("id", { count: "exact", head: true })
    .eq("tipo_mensagem", "lembrete")
    .eq("direcao", "OUT")
    .gte("created_at", inicio.toISOString());
  if (error) {
    console.warn("Não foi possível contar envios de hoje:", error.message);
    return 0;
  }
  return count || 0;
}
