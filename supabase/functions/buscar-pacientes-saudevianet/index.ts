import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// CORS - mesmos origins do sistema
const allowedOrigins = [
  "https://drjulianomachado.com.br",
  "https://www.drjulianomachado.com.br",
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/.*\.lovableproject\.com$/,
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin) {
    const isAllowed = allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin)
    );
    if (isAllowed) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  }
  return headers;
}

// ============================================
// CONFIGURAÇÃO DA API SAÚDEVIANET
// ============================================
const SAUDEVIANET_BASE = "https://apps.saudevianet.com.br/api";

interface SaúdeViaNetToken {
  success: boolean;
  token: string;
  pess_id: string;
  usua_id: string;
  pess_tx_nome: string;
}

interface PacienteFormatado {
  id: string;
  nome: string;
  primeiro_nome: string;
  telefone: string;
  telefone_formatado: string;
  data_atendimento: string;
  data_atendimento_formatada: string;
}

// Formatar telefone brasileiro
function formatarTelefone(tel: string): string {
  if (!tel) return "";
  const numeros = tel.replace(/\D/g, "");
  let digits = numeros;
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return tel;
}

// Formatar data YYYY-MM-DD → DD/MM/YYYY
function formatarData(data: string): string {
  if (!data) return "";
  const p = data.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : data;
}

// Limpar telefone - remover DDI e formatar
function limparTelefone(tel: string): string {
  if (!tel) return "";
  let numeros = tel.replace(/\D/g, "");
  if (numeros.startsWith("55") && numeros.length >= 12) numeros = numeros.slice(2);
  return numeros;
}

// Step 1: Login no SaúdeViaNet
async function loginSaúdeViaNet(): Promise<string> {
  const email = Deno.env.get("SAUDEVIANET_EMAIL");
  const senha = Deno.env.get("SAUDEVIANET_SENHA");

  if (!email || !senha) {
    throw new Error("Credenciais SAUDEVIANET_EMAIL e SAUDEVIANET_SENHA não configuradas");
  }

  const url = `${SAUDEVIANET_BASE}/usuario/logintoken?usua_tx_email=${encodeURIComponent(email)}&usua_tx_senha=${encodeURIComponent(senha)}`;
  
  const resp = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`Login SaúdeViaNet falhou: HTTP ${resp.status}`);
  }

  const data: SaúdeViaNetToken = await resp.json();
  
  if (!data.success || !data.token) {
    throw new Error("Login SaúdeViaNet falhou: credenciais inválidas");
  }

  console.log("Login SaúdeViaNet OK - usuário:", data.pess_tx_nome);
  return data.token;
}

// Step 2: Buscar agendamentos do dia
// NOTA: O endpoint pode precisar de ajuste. Testar:
// - /api/callcenter/listarAgendamentoSemConfirmacao (documentado)
// - /api/agenda/listar
// - /api/agenda/listarAgendamentos
// - /api/callcenter/listarAgendamentos
async function buscarAgendamentos(token: string, dataRef: string): Promise<any[]> {
  // Endpoint principal - AJUSTAR SE NECESSÁRIO
  const endpoints = [
    `${SAUDEVIANET_BASE}/callcenter/listarAgendamentoSemConfirmacao?token=${token}&data_ref=${dataRef}`,
  ];

  for (const url of endpoints) {
    try {
      console.log("Tentando endpoint:", url.replace(token, "TOKEN_HIDDEN"));
      
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!resp.ok) {
        console.log(`Endpoint retornou ${resp.status}, tentando próximo...`);
        continue;
      }

      const data = await resp.json();
      console.log("Resposta recebida, tipo:", typeof data, "isArray:", Array.isArray(data));
      
      // Log dos campos para debug (sem dados sensíveis)
      if (Array.isArray(data) && data.length > 0) {
        console.log("Campos do primeiro registro:", Object.keys(data[0]));
        console.log("Total registros:", data.length);
        return data;
      } else if (data?.agendamentos && Array.isArray(data.agendamentos)) {
        console.log("Campos do primeiro agendamento:", Object.keys(data.agendamentos[0]));
        return data.agendamentos;
      } else if (data?.data && Array.isArray(data.data)) {
        return data.data;
      } else if (data?.success === true) {
        // Procurar array dentro do objeto
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            console.log(`Encontrado array em campo '${key}' com ${data[key].length} itens`);
            console.log("Campos:", Object.keys(data[key][0]));
            return data[key];
          }
        }
      }
      
      console.log("Resposta completa (debug):", JSON.stringify(data).substring(0, 500));
      return Array.isArray(data) ? data : [];
      
    } catch (err) {
      console.error("Erro no endpoint:", err.message);
      continue;
    }
  }

  throw new Error("Nenhum endpoint da API retornou dados válidos");
}

// Step 3: Processar e formatar pacientes
function processarPacientes(agendamentos: any[], dataAtendimento: string): PacienteFormatado[] {
  return agendamentos
    .filter((a) => {
      // Buscar nome em campos possíveis
      const nome = a.pess_tx_nome || a.nome || a.paciente_nome || a.paci_tx_nome || "";
      // Buscar telefone celular ou fixo
      const tel = a.pess_tx_celular || a.paci_tx_celular || a.celular || a.telefone || a.pess_tx_telefone || "";
      const telLimpo = tel.replace(/\D/g, "");
      return nome.trim() !== "" && telLimpo.length >= 10;
    })
    .map((a, idx) => {
      const nome = (a.pess_tx_nome || a.nome || a.paciente_nome || a.paci_tx_nome || "Sem nome").trim();
      const telefone = a.pess_tx_celular || a.paci_tx_celular || a.celular || a.telefone || a.pess_tx_telefone || "";
      const id = a.agen_id || a.paci_id || a.id || String(idx + 1);
      
      return {
        id: String(id),
        nome: nome,
        primeiro_nome: nome.split(" ")[0],
        telefone: limparTelefone(telefone),
        telefone_formatado: formatarTelefone(telefone),
        data_atendimento: dataAtendimento,
        data_atendimento_formatada: formatarData(dataAtendimento),
      };
    });
}

// Handler principal
const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const dataAtendimento = body.data_atendimento;

    if (!dataAtendimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataAtendimento)) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: "data_atendimento é obrigatório no formato YYYY-MM-DD",
          total_pacientes: 0,
          pacientes: [],
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("=== Buscar Pacientes SaúdeViaNet ===");
    console.log("Data solicitada:", dataAtendimento);

    // 1. Login
    const token = await loginSaúdeViaNet();

    // 2. Buscar agendamentos
    const agendamentos = await buscarAgendamentos(token, dataAtendimento);

    // 3. Processar e formatar
    const pacientes = processarPacientes(agendamentos, dataAtendimento);

    console.log(`Resultado: ${pacientes.length} pacientes com telefone de ${agendamentos.length} agendamentos`);

    // 4. Logout (opcional, best practice)
    try {
      await fetch(`${SAUDEVIANET_BASE}/usuario/logouttoken?token=${token}`);
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({
        sucesso: true,
        data_consulta: dataAtendimento,
        total_pacientes: pacientes.length,
        pacientes: pacientes,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Erro ao buscar pacientes SaúdeViaNet:", error.message);

    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error.message || "Erro ao buscar pacientes",
        total_pacientes: 0,
        pacientes: [],
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);