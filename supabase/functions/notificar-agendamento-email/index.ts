import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgendamentoEmailRequest {
  nome_completo: string;
  telefone_whatsapp: string;
  email_paciente?: string;
  data_nascimento?: string;
  tipo_atendimento: string;
  detalhe_exame_ou_cirurgia?: string;
  local_atendimento: string;
  convenio: string;
  convenio_outro?: string;
  data_agendamento: string;
  hora_agendamento: string;
}

// HTML escape function to prevent injection attacks
function escapeHtml(text: string): string {
  if (!text) return '';
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

function formatarData(dataString: string): string {
  try {
    const data = new Date(dataString + 'T00:00:00');
    return data.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return escapeHtml(dataString);
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notificar-agendamento-email: Iniciando...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dados: AgendamentoEmailRequest = await req.json();
    console.log("Dados recebidos para email de agendamento");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    // Sanitize all user inputs
    const nomeCompleto = escapeHtml(dados.nome_completo);
    const telefoneWhatsapp = escapeHtml(dados.telefone_whatsapp);
    const localAtendimento = escapeHtml(dados.local_atendimento);
    const tipoAtendimento = escapeHtml(dados.tipo_atendimento);
    const horaAgendamento = escapeHtml(dados.hora_agendamento);

    const convenioFinal = dados.convenio === "Outro" && dados.convenio_outro 
      ? escapeHtml(dados.convenio_outro) 
      : escapeHtml(dados.convenio);

    const detalheAtendimento = dados.detalhe_exame_ou_cirurgia 
      ? `<p><strong>Detalhe:</strong> ${escapeHtml(dados.detalhe_exame_ou_cirurgia)}</p>` 
      : '';

    const dataNascimento = dados.data_nascimento 
      ? `<p><strong>Data de Nascimento:</strong> ${formatarData(dados.data_nascimento)}</p>` 
      : '';

    const emailPaciente = dados.email_paciente 
      ? `<p><strong>E-mail:</strong> ${escapeHtml(dados.email_paciente)}</p>` 
      : '';

    const dataFormatada = formatarData(dados.data_agendamento);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1e3a5f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .section { margin-bottom: 20px; }
          .section h3 { color: #1e3a5f; border-bottom: 2px solid #c9a227; padding-bottom: 5px; margin-bottom: 10px; }
          .highlight { background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #c9a227; }
          .footer { text-align: center; padding: 15px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🗓️ Novo Agendamento</h1>
            <p>Dr. Juliano Machado - Oftalmologia</p>
          </div>
          
          <div class="content">
            <div class="highlight">
              <strong>📅 ${dataFormatada} às ${horaAgendamento}</strong><br>
              <strong>📍 ${localAtendimento}</strong>
            </div>
            
            <div class="section">
              <h3>👤 Dados do Paciente</h3>
              <p><strong>Nome:</strong> ${nomeCompleto}</p>
              <p><strong>WhatsApp:</strong> ${telefoneWhatsapp}</p>
              ${emailPaciente}
              ${dataNascimento}
            </div>
            
            <div class="section">
              <h3>📋 Detalhes da Consulta</h3>
              <p><strong>Tipo:</strong> ${tipoAtendimento}</p>
              ${detalheAtendimento}
              <p><strong>Convênio:</strong> ${convenioFinal}</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Este e-mail foi enviado automaticamente pelo sistema de agendamentos.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    console.log("Enviando email para julianosmachado@gmail.com...");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Dr. Juliano Machado <contato@send.drjulianomachado.com>",
        to: ["julianosmachado@gmail.com"],
        subject: `Novo Agendamento: ${nomeCompleto} - ${dataFormatada} ${horaAgendamento}`,
        html: htmlContent,
      }),
    });

    const emailResponse = await response.json();

    if (!response.ok) {
      console.error("Erro do Resend:", emailResponse);
      throw new Error(emailResponse.message || "Erro ao enviar email");
    }

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Erro ao enviar email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
