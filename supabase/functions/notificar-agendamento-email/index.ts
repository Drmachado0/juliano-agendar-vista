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
    return dataString;
  }
}

const handler = async (req: Request): Promise<Response> => {
  console.log("notificar-agendamento-email: Iniciando...");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dados: AgendamentoEmailRequest = await req.json();
    console.log("Dados recebidos:", JSON.stringify(dados));

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const convenioFinal = dados.convenio === "Outro" && dados.convenio_outro 
      ? dados.convenio_outro 
      : dados.convenio;

    const detalheAtendimento = dados.detalhe_exame_ou_cirurgia 
      ? `<p><strong>Detalhe:</strong> ${dados.detalhe_exame_ou_cirurgia}</p>` 
      : '';

    const dataNascimento = dados.data_nascimento 
      ? `<p><strong>Data de Nascimento:</strong> ${formatarData(dados.data_nascimento)}</p>` 
      : '';

    const emailPaciente = dados.email_paciente 
      ? `<p><strong>E-mail:</strong> ${dados.email_paciente}</p>` 
      : '';

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
              <strong>📅 ${formatarData(dados.data_agendamento)} às ${dados.hora_agendamento}</strong><br>
              <strong>📍 ${dados.local_atendimento}</strong>
            </div>
            
            <div class="section">
              <h3>👤 Dados do Paciente</h3>
              <p><strong>Nome:</strong> ${dados.nome_completo}</p>
              <p><strong>WhatsApp:</strong> ${dados.telefone_whatsapp}</p>
              ${emailPaciente}
              ${dataNascimento}
            </div>
            
            <div class="section">
              <h3>📋 Detalhes da Consulta</h3>
              <p><strong>Tipo:</strong> ${dados.tipo_atendimento}</p>
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
        from: "Agendamentos Dr. Juliano <onboarding@resend.dev>",
        to: ["julianosmachado@gmail.com"],
        subject: `Novo Agendamento: ${dados.nome_completo} - ${formatarData(dados.data_agendamento)} ${dados.hora_agendamento}`,
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
