// Google Calendar PULL: importa eventos criados/editados/deletados no Google
// Calendar para a tabela `agendamentos`. Usa polling incremental via syncToken,
// com fallback automático para full sync caso o token expire (HTTP 410).
//
// Pode ser chamado:
//  1) Pelo cron pg_cron a cada 15 minutos (header x-cron-secret = CRON_SECRET).
//  2) Manualmente pelo admin (header Authorization: Bearer <jwt>) — botão
//     "Sincronizar agora" na UI. Nesse caso processa apenas o user_id informado.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

interface GoogleEvent {
  id: string;
  status?: string;
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || "Failed to refresh token");
  }
  return data;
}

async function getValidAccessToken(supabase: any, userId: string, tokenData: any) {
  const tokenExpiry = new Date(tokenData.token_expiry);
  if (tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken(tokenData.refresh_token);
    const newExpiry = new Date(Date.now() + newTokens.expires_in * 1000)
      .toISOString();
    await supabase
      .from("google_calendar_tokens")
      .update({
        access_token: newTokens.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return newTokens.access_token;
  }
  return tokenData.access_token;
}

// ===================== Parser =====================

function extractPhone(text: string): string | null {
  // Aceita formatos BR comuns: (91) 99999-9999, 91999999999, 91 9 9999-9999
  const m = text.match(/\(?\d{2}\)?\s*9?\s*\d{4}[-\s]?\d{4}/);
  if (!m) return null;
  return m[0].replace(/\D/g, "");
}

function extractEmail(text: string): string | null {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

function detectConvenio(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("unimed")) return "Unimed";
  if (t.includes("bradesco")) return "Bradesco";
  if (t.includes("cassi")) return "Cassi";
  if (t.includes("sul américa") || t.includes("sul america") || t.includes("sulamerica")) {
    return "Sul América";
  }
  if (t.includes("particular")) return "Particular";
  return "Particular";
}

function detectTipoAtendimento(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("cirurgia")) return "Cirurgia";
  if (t.includes("exame")) return "Exame";
  if (t.includes("retorno")) return "Retorno";
  return "Consulta";
}

function extractName(summary: string, description: string): string {
  // Tenta padrão "Tipo - Nome" do nosso próprio buildEvent (caso evento tenha
  // sido criado externamente seguindo a mesma convenção).
  const dashMatch = summary.match(/^[^-]+-\s*(.+)$/);
  if (dashMatch && dashMatch[1].trim().length > 2) {
    return dashMatch[1].trim();
  }
  // Senão, primeira linha do summary.
  const firstLine = summary.split("\n")[0].trim();
  if (firstLine.length > 2) return firstLine;
  // Última tentativa: linha "Paciente: ..." na descrição.
  const desc = description || "";
  const pacMatch = desc.match(/(?:paciente|nome)\s*[:\-]\s*(.+)/i);
  if (pacMatch) return pacMatch[1].trim().split("\n")[0];
  return "Evento Google";
}

interface ParsedEvent {
  nome_completo: string;
  telefone_whatsapp: string;
  email: string | null;
  convenio: string;
  tipo_atendimento: string;
  data_agendamento: string;
  hora_agendamento: string;
}

function parseEvent(event: GoogleEvent): ParsedEvent | null {
  const startDateTime = event.start?.dateTime;
  if (!startDateTime) return null; // ignora eventos de dia inteiro

  const dt = new Date(startDateTime);
  if (Number.isNaN(dt.getTime())) return null;

  // Formata em horário local (no fuso do evento, que o Google já entrega normalizado).
  // Para simplicidade armazenamos data/hora como strings no fuso devolvido pelo Google.
  const tz = event.start?.timeZone || "America/Sao_Paulo";
  // Constrói a partir do dateTime original (que é ISO com offset).
  const isoMatch = startDateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  const data = isoMatch ? isoMatch[1] : dt.toISOString().slice(0, 10);
  const hora = isoMatch ? isoMatch[2] + ":00" : dt.toISOString().slice(11, 16) + ":00";

  const text = `${event.summary || ""}\n${event.description || ""}`;
  const telefone = extractPhone(text) || "0000000000";
  const email = extractEmail(text);
  const nome = extractName(event.summary || "", event.description || "");
  const convenio = detectConvenio(text);
  const tipo = detectTipoAtendimento(text);

  return {
    nome_completo: nome,
    telefone_whatsapp: telefone,
    email,
    convenio,
    tipo_atendimento: tipo,
    data_agendamento: data,
    hora_agendamento: hora,
    // tz unused but kept for context
  } as ParsedEvent;
}

// ===================== Pull para 1 user =====================

interface PullResult {
  user_id: string;
  imported: number;
  updated: number;
  cancelled: number;
  conflicts: number;
  errors: string[];
}

type RangeOption = "default" | "hoje" | "7dias" | "mes";

function computeRangeWindow(range: RangeOption): { timeMin: string; timeMax: string } | null {
  const now = new Date();
  if (range === "hoje") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  if (range === "7dias") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  if (range === "mes") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { timeMin: start.toISOString(), timeMax: end.toISOString() };
  }
  return null;
}

async function pullForUser(
  supabase: any,
  tokenRow: any,
  range: RangeOption = "default",
): Promise<PullResult> {
  const userId = tokenRow.user_id;
  const result: PullResult = {
    user_id: userId,
    imported: 0,
    updated: 0,
    cancelled: 0,
    conflicts: 0,
    errors: [],
  };

  // Busca settings (para descobrir clínica padrão de importação)
  const { data: settings } = await supabase
    .from("google_calendar_settings")
    .select("default_import_clinica_id")
    .eq("user_id", userId)
    .maybeSingle();

  let defaultLocal = "Clinicor – Paragominas";
  let defaultClinicaId: string | null = settings?.default_import_clinica_id ?? null;
  if (defaultClinicaId) {
    const { data: clinica } = await supabase
      .from("clinicas")
      .select("nome")
      .eq("id", defaultClinicaId)
      .maybeSingle();
    if (clinica?.nome) defaultLocal = clinica.nome;
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(supabase, userId, tokenRow);
  } catch (e: any) {
    result.errors.push(`token: ${e.message}`);
    return result;
  }

  const calendarId = tokenRow.calendar_id || "primary";
  const rangeWindow = computeRangeWindow(range);
  // Se o admin escolheu um range específico, força full sync nessa janela
  // (ignora syncToken para que eventos passados/futuros sejam reimportados).
  const forceFullSync = rangeWindow !== null;

  // Monta URL: usa syncToken se houver e não estiver forçando range, senão full sync.
  const buildUrl = (syncToken: string | null, pageToken?: string) => {
    const u = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${
        encodeURIComponent(calendarId)
      }/events`,
    );
    u.searchParams.set("singleEvents", "true");
    u.searchParams.set("showDeleted", "true");
    u.searchParams.set("maxResults", "250");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    if (syncToken && !forceFullSync) {
      u.searchParams.set("syncToken", syncToken);
    } else {
      // Full sync — janela escolhida pelo admin OU padrão (agora → +90 dias)
      if (rangeWindow) {
        u.searchParams.set("timeMin", rangeWindow.timeMin);
        u.searchParams.set("timeMax", rangeWindow.timeMax);
      } else {
        u.searchParams.set("timeMin", new Date().toISOString());
        const future = new Date();
        future.setDate(future.getDate() + 90);
        u.searchParams.set("timeMax", future.toISOString());
      }
      u.searchParams.set("orderBy", "startTime");
    }
    return u.toString();
  };

  let syncToken: string | null = forceFullSync ? null : (tokenRow.sync_token ?? null);
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;
  const allEvents: GoogleEvent[] = [];

  // Loop por páginas
  for (let page = 0; page < 20; page++) {
    const url = buildUrl(syncToken, pageToken);
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (resp.status === 410) {
      // syncToken expirado — limpar e refazer full sync nesta mesma execução
      console.log(`[gcal-pull] syncToken expirado para user ${userId}, refazendo full sync`);
      syncToken = null;
      pageToken = undefined;
      continue;
    }

    const data = await resp.json();
    if (!resp.ok) {
      result.errors.push(
        `list: ${resp.status} ${data.error?.message || "unknown"}`,
      );
      return result;
    }

    if (Array.isArray(data.items)) allEvents.push(...data.items);
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
    if (!pageToken) break;
  }

  // Processa eventos
  for (const ev of allEvents) {
    try {
      // Anti-loop: ignora eventos criados pelo nosso próprio sistema
      const source = ev.extendedProperties?.private?.source;
      if (source === "lovable") continue;

      // Busca registro existente pelo event id
      const { data: existing } = await supabase
        .from("agendamentos")
        .select("id, google_calendar_etag, status_funil")
        .eq("google_calendar_event_id", ev.id)
        .maybeSingle();

      // Cancelado / deletado
      if (ev.status === "cancelled") {
        if (existing) {
          await supabase
            .from("agendamentos")
            .update({
              status_funil: "cancelado",
              google_calendar_synced_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          result.cancelled++;
        }
        continue;
      }

      const parsed = parseEvent(ev);
      if (!parsed) continue;

      if (existing) {
        // Update — só se etag mudou
        if (existing.google_calendar_etag === ev.etag) continue;
        await supabase
          .from("agendamentos")
          .update({
            data_agendamento: parsed.data_agendamento,
            hora_agendamento: parsed.hora_agendamento,
            tipo_atendimento: parsed.tipo_atendimento,
            convenio: parsed.convenio,
            google_calendar_etag: ev.etag,
            google_calendar_synced_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        result.updated++;
      } else {
        // Verifica conflito de horário (mesmo slot já ocupado)
        let observacoesConflito: string | null = null;
        const { count: conflictCount } = await supabase
          .from("agendamentos")
          .select("id", { count: "exact", head: true })
          .eq("data_agendamento", parsed.data_agendamento)
          .eq("hora_agendamento", parsed.hora_agendamento)
          .eq("local_atendimento", defaultLocal);

        if ((conflictCount ?? 0) > 0) {
          observacoesConflito =
            "⚠️ Conflito detectado na importação do Google Calendar — horário já ocupado.";
          result.conflicts++;
        }

        // Eventos do Google Calendar sem telefone real (ex.: marcadores "Almoço",
        // "Belém", "SUS") não são leads de paciente. Marcamos como
        // BLOQUEIO/AGENDA para que ocupem o horário na agenda mas NÃO apareçam
        // no CRM Kanban.
        const semTelefoneReal = parsed.telefone_whatsapp === "0000000000";
        const statusCrm = semTelefoneReal ? "BLOQUEIO/AGENDA" : "NOVO LEAD";
        const statusFunil = semTelefoneReal ? "bloqueio" : "agendado";

        const insertPayload: Record<string, unknown> = {
          nome_completo: parsed.nome_completo,
          telefone_whatsapp: parsed.telefone_whatsapp,
          email: parsed.email,
          tipo_atendimento: parsed.tipo_atendimento,
          local_atendimento: defaultLocal,
          convenio: parsed.convenio,
          data_agendamento: parsed.data_agendamento,
          hora_agendamento: parsed.hora_agendamento,
          status_crm: statusCrm,
          status_funil: statusFunil,
          origem: "google_calendar",
          google_calendar_event_id: ev.id,
          google_calendar_etag: ev.etag,
          google_calendar_synced_at: new Date().toISOString(),
        };
        if (defaultClinicaId) insertPayload.clinica_id = defaultClinicaId;
        if (observacoesConflito) insertPayload.observacoes_internas = observacoesConflito;


        const { error: insErr } = await supabase
          .from("agendamentos")
          .insert(insertPayload);
        if (insErr) {
          result.errors.push(`insert ${ev.id}: ${insErr.message}`);
        } else {
          result.imported++;
        }
      }
    } catch (e: any) {
      result.errors.push(`event ${ev.id}: ${e.message}`);
    }
  }

  // Salva nextSyncToken (apenas em sync padrão) e last_pull_at.
  // Em range customizado, NÃO sobrescreve o sync_token para preservar o estado
  // do polling incremental geral.
  const updatePayload: Record<string, unknown> = {
    last_pull_at: new Date().toISOString(),
  };
  if (!forceFullSync) updatePayload.sync_token = nextSyncToken;
  await supabase
    .from("google_calendar_tokens")
    .update(updatePayload)
    .eq("user_id", userId);

  return result;
}

// ===================== HTTP handler =====================

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Auth: x-cron-secret OU JWT admin
    const cronHeader = req.headers.get("x-cron-secret");
    const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET;

    let targetUserId: string | null = null;
    let isAdminCall = false;
    let range: RangeOption = "default";

    if (!isCron) {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const jwt = authHeader.slice(7);
      const userClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
      if (userErr || !userData.user) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Verifica role admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(
          JSON.stringify({ error: "Admin role required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      isAdminCall = true;
      // Body opcional: { user_id, range }
      try {
        const body = await req.json();
        targetUserId = body?.user_id ?? userData.user.id;
        const r = body?.range;
        if (r === "hoje" || r === "7dias" || r === "mes") range = r;
      } catch {
        targetUserId = userData.user.id;
      }
    }

    // Carrega tokens a processar
    let query = supabase
      .from("google_calendar_tokens")
      .select("*")
      .eq("pull_enabled", true);
    if (targetUserId) query = query.eq("user_id", targetUserId);

    const { data: tokens, error: tokErr } = await query;
    if (tokErr) throw tokErr;
    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "Nenhuma conta com pull habilitado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: PullResult[] = [];
    for (const tok of tokens) {
      const r = await pullForUser(supabase, tok, range);
      results.push(r);
      console.log(
        `[gcal-pull] user=${r.user_id} imported=${r.imported} updated=${r.updated} cancelled=${r.cancelled} conflicts=${r.conflicts} errors=${r.errors.length}`,
      );
    }

    // Agrega
    const totals = results.reduce((acc, r) => {
      acc.imported += r.imported;
      acc.updated += r.updated;
      acc.cancelled += r.cancelled;
      acc.conflicts += r.conflicts;
      acc.errors += r.errors.length;
      return acc;
    }, { imported: 0, updated: 0, cancelled: 0, conflicts: 0, errors: 0 });

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, totals, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[google-calendar-pull] error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
