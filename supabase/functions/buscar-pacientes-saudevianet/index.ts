import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SAUDEVIANET_BASE = "https://apps.saudevianet.com.br";
const PROF_ID = "911C6E05-8CA7-09EC-4A58-F39EAEC9EB3D";
const AGDA_ID = "BAAA2084-0B93-60A7-22B8-5041717296E7";

function formatarTelefone(tel: string): string {
  if (!tel) return "";
  const numeros = tel.replace(/\D/g, "");
  let digits = numeros;
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return tel;
}

function formatarDataBR(data: string): string {
  if (!data) return "";
  const p = data.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : data;
}

function limparTelefone(tel: string): string {
  if (!tel) return "";
  let numeros = tel.replace(/\D/g, "");
  if (numeros.startsWith("55") && numeros.length >= 12) numeros = numeros.slice(2);
  return numeros;
}

// Extrair primeiro telefone válido (pode vir múltiplos separados por vírgula)
function extrairPrimeiroTelefone(telefones: string): string {
  if (!telefones) return "";
  const lista = telefones.split(",").map(t => t.trim());
  for (const tel of lista) {
    const limpo = tel.replace(/\D/g, "");
    if (limpo.length >= 10) return tel;
  }
  return lista[0] || "";
}

// Converter data YYYY-MM-DD para timestamps Unix (Belém UTC-3)
function dataParaTimestamps(dataStr: string): { start: number; end: number } {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const startDate = new Date(Date.UTC(ano, mes - 1, dia, 3, 0, 0));
  const start = Math.floor(startDate.getTime() / 1000);
  const end = start + 86400;
  return { start, end };
}

// Login no SaúdeViaNet - retorna token e cookies
async function loginSaudeViaNet(): Promise<{ token: string; cookies: string }> {
  const email = Deno.env.get("SAUDEVIANET_EMAIL");
  const senha = Deno.env.get("SAUDEVIANET_SENHA");

  if (!email || !senha) {
    throw new Error("Credenciais SAUDEVIANET_EMAIL e SAUDEVIANET_SENHA nao configuradas");
  }

  const url = `${SAUDEVIANET_BASE}/api/usuario/logintoken?usua_tx_email=${encodeURIComponent(email)}&usua_tx_senha=${encodeURIComponent(senha)}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  // Capturar cookies da resposta
  const allHeaders = [...resp.headers.entries()];
  const cookieParts: string[] = [];
  for (const [key, value] of allHeaders) {
    if (key.toLowerCase() === "set-cookie") {
      cookieParts.push(value.split(";")[0]);
    }
  }
  const cookies = cookieParts.join("; ");

  const data = await resp.json();

  if (!data.success || !data.token) {
    throw new Error("Login SaudeViaNet falhou: credenciais invalidas");
  }

  console.log("Login OK:", data.pess_tx_nome);
  return { token: data.token, cookies };
}

// Buscar agenda do dia via consultaAgenda (mesmo endpoint do navegador)
async function buscarAgenda(token: string, cookies: string, dataStr: string): Promise<any[]> {
  const { start, end } = dataParaTimestamps(dataStr);

  const formData = new URLSearchParams();
  formData.append("prof_id", PROF_ID);
  formData.append("agda_id", AGDA_ID);
  formData.append("inst_id", "null");
  formData.append("bloqueios", "true");
  formData.append("statusCheck", "'5','1','2','3','8','7','4'");
  formData.append("start", start.toString());
  formData.append("end", end.toString());

  const url = `${SAUDEVIANET_BASE}/ajax/index/interface/funcao/consultaAgenda`;

  console.log(`Buscando agenda: data=${dataStr}, start=${start}, end=${end}`);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookies,
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": `${SAUDEVIANET_BASE}/agenda`,
    },
    body: formData.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Erro consultaAgenda:", resp.status, text.substring(0, 300));
    throw new Error(`consultaAgenda falhou: HTTP ${resp.status}`);
  }

  const data = await resp.json();

  if (Array.isArray(data)) {
    console.log("Total registros da API:", data.length);
    return data;
  }

  console.log("Resposta nao e array:", JSON.stringify(data).substring(0, 300));
  return [];
}

// Processar pacientes - campos confirmados da API:
// title = nome, telefones = telefone(s), siag = 5 = atendido, status = "Atendido"
// className = "evento-bloqueio" = bloqueio (ignorar)
function processarPacientes(agendamentos: any[], dataAtendimento: string): any[] {
  return agendamentos
    .filter((a) => {
      // Ignorar bloqueios
      if (a.className === "evento-bloqueio" || a.tipo_bloqueio) return false;

      // Apenas atendidos (siag === 5)
      const isAtendido = a.siag === 5 || a.status === "Atendido";
      if (!isAtendido) return false;

      // Deve ter nome e telefone valido
      const nome = a.title || "";
      const telefone = a.telefones || "";
      const telLimpo = extrairPrimeiroTelefone(telefone).replace(/\D/g, "");

      return nome.trim() !== "" && telLimpo.length >= 10;
    })
    .map((a) => {
      const nome = (a.title || "Sem nome").trim();
      const telefoneRaw = extrairPrimeiroTelefone(a.telefones || "");

      return {
        id: String(a.id),
        nome: nome,
        primeiro_nome: nome.split(" ")[0],
        telefone: limparTelefone(telefoneRaw),
        telefone_formatado: formatarTelefone(telefoneRaw),
        data_atendimento: dataAtendimento,
        data_atendimento_formatada: formatarDataBR(dataAtendimento),
      };
    });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo nao permitido" }), {
      status: 405, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const dataAtendimento = body.data_atendimento;

    if (!dataAtendimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataAtendimento)) {
      return new Response(
        JSON.stringify({ sucesso: false, erro: "data_atendimento obrigatorio (YYYY-MM-DD)", total_pacientes: 0, pacientes: [] }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("=== Buscar Pacientes SaudeViaNet ===");
    console.log("Data:", dataAtendimento);

    // 1. Login
    const { token, cookies } = await loginSaudeViaNet();

    // 2. Buscar agenda
    const agendamentos = await buscarAgenda(token, cookies, dataAtendimento);

    // 3. Processar
    const pacientes = processarPacientes(agendamentos, dataAtendimento);

    console.log(`Resultado: ${pacientes.length} pacientes atendidos de ${agendamentos.length} registros`);

    // 4. Logout
    try { await fetch(`${SAUDEVIANET_BASE}/api/usuario/logouttoken?token=${token}`); } catch { /* ok */ }

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
    console.error("ERRO:", error.message);
    return new Response(
      JSON.stringify({ sucesso: false, erro: error.message, total_pacientes: 0, pacientes: [] }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
