import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Check, Copy, Download, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ENDPOINT = "https://<seu-projeto>.functions.supabase.co/mcp-agendamento";

type Snippet = {
  id: string;
  title: string;
  description: string;
  code: string;
};

const AUTH_SNIPPET = `POST ${ENDPOINT}
Content-Type: application/json
x-n8n-secret: <N8N_SHARED_SECRET>

# Aliases aceitos para o MESMO segredo (envie apenas UM deles):
#   x-mcp-secret: <segredo>
#   x-api-key: <segredo>
#   apikey: <segredo>
#   Authorization: Bearer <segredo>
#
# Observação: NÃO use a anon key nem o JWT do Supabase aqui.
# A função roda com verify_jwt = false e valida somente o segredo compartilhado.`;

const N8N_HTTP_SNIPPET = `Nó: HTTP Request
  Method:        POST
  URL:           ${ENDPOINT}
  Authentication: Generic Credential Type → Header Auth
      Name:  x-n8n-secret
      Value: <N8N_SHARED_SECRET>
  Send Headers:  ON
      Content-Type: application/json
  Send Body:     ON  → Body Content Type: JSON
      Specify Body: Using JSON
      JSON: {{ $json.payload }}   // ou cole o corpo JSON-RPC direto

Nó: MCP Client (n8n AI Agent)
  Endpoint:   ${ENDPOINT}
  Transport:  HTTP (Streamable) / JSON-RPC
  Headers:    x-n8n-secret = <N8N_SHARED_SECRET>`;

const CURL_SNIPPET = `curl -X POST "${ENDPOINT}" \\
  -H "Content-Type: application/json" \\
  -H "x-n8n-secret: $N8N_SHARED_SECRET" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Esperado: HTTP 200 com a lista de tools.
# HTTP 400/401 com { "error": { "code": -32001, "message": "Unauthorized" } }
#   → header ausente, nome do header errado, ou segredo divergente.`;

const AUTH_TROUBLESHOOTING: Array<[string, string]> = [
  [
    "Unauthorized (-32001)",
    "O header não chegou ou o valor não confere. Confirme o nome exato do header e que o valor não tem espaços/quebras de linha coladas.",
  ],
  [
    "Enviou Authorization com JWT",
    "O header Authorization só é lido no formato Bearer <segredo compartilhado>. Um JWT de usuário ou a anon key não autenticam esta função.",
  ],
  [
    "Funciona no Postman e falha no n8n",
    "No n8n use Header Auth (credencial) em vez de digitar o header em Options → Headers; assim o valor não vaza no log de execução.",
  ],
  [
    "GET retorna 200 mas tools não aparecem",
    "GET é apenas health check e não exige segredo. As tools só respondem em POST autenticado.",
  ],
];


const SNIPPETS: Snippet[] = [
  {
    id: "initialize",
    title: "initialize",
    description:
      "Handshake MCP. Responde protocolVersion, capabilities e serverInfo.",
    code: `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {}
}

// Resposta
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "mcp-agendamento", "version": "3.0.0" }
  }
}`,
  },
  {
    id: "tools-list",
    title: "tools/list",
    description: "Lista as 5 tools disponíveis com seus inputSchema.",
    code: `{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}`,
  },
  {
    id: "listar_datas_disponiveis",
    title: "tools/call — listar_datas_disponiveis",
    description:
      "Datas de um mês que possuem horários livres, com a quantidade de vagas. local é opcional.",
    code: `{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "listar_datas_disponiveis",
    "arguments": {
      "mes": 8,
      "ano": 2026,
      "local": "Clinicor"
    }
  }
}`,
  },
  {
    id: "listar_horarios_disponiveis",
    title: "tools/call — listar_horarios_disponiveis",
    description:
      "Horários livres de uma data e local, já descontando bloqueios e agendamentos existentes.",
    code: `{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "listar_horarios_disponiveis",
    "arguments": {
      "data": "2026-08-12",
      "local": "HGP"
    }
  }
}`,
  },
  {
    id: "validar_horario",
    title: "tools/call — validar_horario",
    description:
      "Confirma se um trio (data, hora, local) continua livre antes de fechar o agendamento.",
    code: `{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "validar_horario",
    "arguments": {
      "data_agendamento": "2026-08-12",
      "hora_agendamento": "14:30",
      "local_atendimento": "HGP"
    }
  }
}`,
  },
  {
    id: "criar_agendamento",
    title: "tools/call — criar_agendamento",
    description:
      "Confirma um card EXISTENTE do CRM. Fail-closed: exige agendamento_id em UUID e nunca cria card novo por telefone.",
    code: `{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "criar_agendamento",
    "arguments": {
      "agendamento_id": "c08f1c2e-4a1b-4f77-9f0a-2b7d5f3a9e10",
      "nome_completo": "Maria de Souza",
      "telefone_whatsapp": "91991150174",
      "tipo_atendimento": "Consulta",
      "local_atendimento": "Clinicor",
      "convenio": "Particular",
      "data_agendamento": "2026-08-12",
      "hora_agendamento": "14:30"
    }
  }
}`,
  },
  {
    id: "cancelar_agendamento",
    title: "tools/call — cancelar_agendamento",
    description:
      "Cancela o próximo agendamento futuro. Informe agendamento_id OU telefone.",
    code: `{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "cancelar_agendamento",
    "arguments": {
      "telefone": "91991150174",
      "motivo": "Paciente pediu remarcação"
    }
  }
}`,
  },
];

const RESPONSE_SHAPE = `// Sucesso (o payload da tool vem serializado em content[0].text)
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "content": [
      { "type": "text", "text": "{\\"sucesso\\":true,\\"agendamento_id\\":\\"c08f1c2e-…\\"}" }
    ]
  }
}

// Erro de execução da tool
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "content": [{ "type": "text", "text": "Erro: horario_indisponivel" }],
    "isError": true
  }
}

// Erro de protocolo / autenticação (HTTP 400)
{ "jsonrpc": "2.0", "id": null, "error": { "code": -32001, "message": "Unauthorized" } }`;

const POSTMAN_FILE = "/mcp-agendamento.postman_collection.json";

const POSTMAN_IMPORT_STEPS = `1. Baixe o arquivo mcp-agendamento.postman_collection.json
2. No Postman: File → Import → selecione o arquivo (ou cole o JSON em "Raw text")
3. Abra a coleção → aba Variables e preencha:
     baseUrl   = ${ENDPOINT}
     n8nSecret = <N8N_SHARED_SECRET>   (use Current value, nunca Initial value)
4. Envie qualquer request — o header x-n8n-secret já vem configurado.`;

const MOTIVOS: Array<[string, string]> = [
  ["agendamento_id_obrigatorio", "UUID ausente ou inválido — a tool nunca cria card novo."],
  ["agendamento_nao_encontrado", "Nenhum card com esse UUID."],
  ["nome_invalido", "Nome com menos de 2 caracteres ou placeholder da IA."],
  ["horario_indisponivel", "Slot ocupado ou bloqueado no momento da confirmação."],
  ["local_invalido", "Local fora de Clinicor | HGP | IOB | Vitria."],
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="absolute right-2 top-2 h-8 gap-1.5"
        onClick={handleCopy}
        aria-label="Copiar exemplo"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export default function DocsMcpAgendamento() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Documentação MCP Agendamento — JSON-RPC 2.0</title>
        <meta
          name="description"
          content="Referência técnica das tools do servidor MCP de agendamento: exemplos de chamadas JSON-RPC 2.0 e payloads para integração no n8n."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <header className="mb-10">
          <Badge variant="secondary" className="mb-3 gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            JSON-RPC 2.0 · MCP
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            mcp-agendamento — referência de integração
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Exemplos prontos de chamadas e payloads das tools expostas pelo
            servidor MCP usado pelo agente do n8n. Copie e cole direto nos nós
            HTTP Request ou MCP Client.
          </p>
        </header>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Endpoint e autenticação</CardTitle>
            <p className="text-sm text-muted-foreground">
              Toda chamada de tool é <strong>POST</strong> com corpo JSON-RPC 2.0
              e um <strong>header de segredo compartilhado</strong>. Sem esse
              header a resposta é <code className="rounded bg-muted px-1 py-0.5 text-xs">Unauthorized</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                Pegue o valor de{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">N8N_SHARED_SECRET</code>{" "}
                em <strong>Admin → Configurações → Integrações</strong> (card de
                rotação de segredo).
              </li>
              <li>
                Envie-o em <strong>um</strong> header:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">x-n8n-secret</code>{" "}
                (recomendado) ou um dos aliases abaixo.
              </li>
              <li>
                Adicione também{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">Content-Type: application/json</code>.
              </li>
              <li>
                O segredo nunca deve ir para o navegador — use-o apenas em
                credenciais do n8n / variáveis de ambiente.
              </li>
            </ol>
            <CodeBlock code={AUTH_SNIPPET} />

            <div>
              <h3 className="mb-2 text-sm font-semibold">Configuração no n8n</h3>
              <CodeBlock code={N8N_HTTP_SNIPPET} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Teste rápido (curl)</h3>
              <CodeBlock code={CURL_SNIPPET} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Erros comuns de autenticação
              </h3>
              <ul className="space-y-2">
                {AUTH_TROUBLESHOOTING.map(([titulo, texto]) => (
                  <li key={titulo} className="text-sm">
                    <span className="font-medium">{titulo}</span>
                    <span className="ml-2 text-muted-foreground">{texto}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-muted-foreground">
              <strong>GET</strong> não exige segredo e retorna apenas um health
              check mínimo:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {`{ "success": true, "service": "mcp-agendamento" }`}
              </code>
            </p>
          </CardContent>
        </Card>


        <section className="space-y-6">
          {SNIPPETS.map((snippet) => (
            <Card key={snippet.id} id={snippet.id}>
              <CardHeader>
                <CardTitle className="font-mono text-base">{snippet.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{snippet.description}</p>
              </CardHeader>
              <CardContent>
                <CodeBlock code={snippet.code} />
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Coleção Postman</CardTitle>
            <p className="text-sm text-muted-foreground">
              Importe todos os exemplos acima de uma vez. Após importar, defina
              as variáveis da coleção <code className="rounded bg-muted px-1 py-0.5 text-xs">baseUrl</code>{" "}
              e <code className="rounded bg-muted px-1 py-0.5 text-xs">n8nSecret</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="gap-1.5">
                <a href={POSTMAN_FILE} download="mcp-agendamento.postman_collection.json">
                  <Download className="h-3.5 w-3.5" />
                  Baixar coleção (.json)
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={POSTMAN_FILE} target="_blank" rel="noreferrer">
                  Abrir JSON para copiar
                </a>
              </Button>
            </div>
            <CodeBlock code={POSTMAN_IMPORT_STEPS} />
          </CardContent>
        </Card>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Formato das respostas</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={RESPONSE_SHAPE} />
          </CardContent>
        </Card>


        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">
              Motivos de falha em criar_agendamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {MOTIVOS.map(([motivo, texto]) => (
                <li key={motivo} className="text-sm">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {motivo}
                  </code>
                  <span className="ml-2 text-muted-foreground">{texto}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <footer className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          Documentação técnica interna · protocolo MCP 2024-11-05 · servidor
          versão 3.0.0
        </footer>
      </div>
    </div>
  );
}
