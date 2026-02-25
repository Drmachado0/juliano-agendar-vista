/**
 * mcp-agendamento — Supabase Edge Function
 * MCP Server com Streamable HTTP Transport (compatível com n8n MCP Client)
 *
 * Usa o SDK oficial @modelcontextprotocol/sdk com StreamableHttpTransport
 * para full compatibility com n8n 2.9+
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ─── Supabase client ──────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function supabaseRPC(fn: string, params: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase RPC ${fn} failed [${res.status}]: ${err}`);
  }
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", server: "mcp-agendamento", version: "2.0.0", transport: "streamable-http", tools: ["listar_horarios_disponiveis", "validar_horario", "criar_agendamento"] }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    const response = await transport.handleRequest(req);
    await server.close();
    return response;
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
