import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface DadosTemplate {
  nome?: string;
  data?: string;
  hora?: string;
  local?: string;
  profissional?: string;
  tipo_atendimento?: string;
  convenio?: string;
}

// Templates padrão (fallback caso não exista no banco)
const templatesPadrao: Record<string, string> = {
  confirmacao_agendamento: `Olá, {{nome}}! 👋

Recebemos seu pedido de agendamento na clínica do *Dr. Juliano Machado - Oftalmologista*.

📅 *Data:* {{data}}
⏰ *Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Importante:* O atendimento será realizado por *ordem de chegada*. Recomendamos chegar com antecedência.

Caso precise reagendar ou cancelar, entre em contato conosco.

Agradecemos a preferência! 🙏`,
  
  lembrete_24h: `Olá, {{nome}}! 👋

Este é um lembrete do seu agendamento na clínica do *Dr. Juliano Machado - Oftalmologista*.

📅 *Data:* {{data}}
⏰ *Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Lembre-se:* O atendimento será por *ordem de chegada*.

Caso não possa comparecer, por favor nos avise.

Até amanhã! 🙏`,
  
  resposta_confirmacao: `Sua presença foi *confirmada* com sucesso! ✅

Aguardamos você na data e horário agendados.

Qualquer dúvida, estamos à disposição. 🙏`,
  
  resposta_cancelamento: `Seu agendamento foi *cancelado* conforme solicitado. ❌

Caso deseje reagendar, acesse nosso site ou entre em contato.

Obrigado! 🙏`,
  
  reagendamento: `Olá, {{nome}}! 👋

Sua consulta foi *reagendada* para:

📅 *Nova Data:* {{data}}
⏰ *Novo Horário:* {{hora}}
📍 *Local:* {{local}}

⚠️ *Lembre-se:* O atendimento será por *ordem de chegada*.

Qualquer dúvida, estamos à disposição! 🙏`,

  boas_vindas_lead: `Olá, {{nome}}! Aqui é da clínica *Dr. Juliano Machado - Oftalmologista*. 👋

Vimos seu interesse em agendar uma {{tipo_atendimento}} no local *{{local}}*.

Qual data e horário seriam melhores para você? 📅

Aguardamos seu retorno! 🙏`,
};

// Busca template do banco de dados
export async function buscarTemplate(tipo: string): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('templates_whatsapp')
      .select('conteudo')
      .eq('tipo', tipo)
      .eq('ativo', true)
      .single();

    if (error || !data) {
      console.log(`[TemplateRenderer] Template ${tipo} não encontrado no banco, usando padrão`);
      return templatesPadrao[tipo] || '';
    }

    console.log(`[TemplateRenderer] Template ${tipo} carregado do banco`);
    return data.conteudo;
  } catch (error) {
    console.error(`[TemplateRenderer] Erro ao buscar template ${tipo}:`, error);
    return templatesPadrao[tipo] || '';
  }
}

// Renderiza um template substituindo variáveis pelos valores
export function renderizarTemplate(template: string, dados: DadosTemplate): string {
  let mensagem = template;

  const variaveis: Record<string, string | undefined> = {
    '{{nome}}': dados.nome,
    '{{data}}': dados.data,
    '{{hora}}': dados.hora,
    '{{local}}': dados.local,
    '{{profissional}}': dados.profissional,
    '{{tipo_atendimento}}': dados.tipo_atendimento,
    '{{convenio}}': dados.convenio,
  };

  for (const [variavel, valor] of Object.entries(variaveis)) {
    if (valor) {
      mensagem = mensagem.replace(new RegExp(variavel.replace(/[{}]/g, '\\$&'), 'g'), valor);
    }
  }

  // Remove linhas com variáveis não preenchidas
  mensagem = mensagem
    .split('\n')
    .filter(linha => !linha.includes('{{'))
    .join('\n');

  return mensagem;
}

// Formata data de YYYY-MM-DD para DD/MM/YYYY
export function formatarData(dataStr: string): string {
  try {
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  } catch {
    return dataStr;
  }
}

// Formata hora para HH:MM
export function formatarHora(horaStr: string): string {
  return horaStr.slice(0, 5);
}

// Busca e renderiza template em uma única chamada
export async function gerarMensagemDoTemplate(
  tipo: string, 
  dados: DadosTemplate
): Promise<string> {
  const template = await buscarTemplate(tipo);
  return renderizarTemplate(template, dados);
}
