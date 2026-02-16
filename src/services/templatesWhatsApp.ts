import { supabase } from "@/integrations/supabase/client";

export interface TemplateWhatsApp {
  id: string;
  tipo: string;
  nome: string;
  conteudo: string;
  descricao: string | null;
  variaveis_disponiveis: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface DadosTemplate {
  nome?: string;
  data?: string;
  hora?: string;
  local?: string;
  profissional?: string;
  tipo_atendimento?: string;
  convenio?: string;
}

// Lista todos os templates (incluindo inativos para admin)
export async function listarTemplates(): Promise<{ data: TemplateWhatsApp[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('templates_whatsapp')
    .select('*')
    .order('nome');

  if (error) {
    console.error('[Templates] Erro ao listar:', error);
    return { data: null, error: error.message };
  }

  return { data: data as TemplateWhatsApp[], error: null };
}

// Busca um template específico por tipo
export async function buscarTemplatePorTipo(tipo: string): Promise<{ data: TemplateWhatsApp | null; error: string | null }> {
  const { data, error } = await supabase
    .from('templates_whatsapp')
    .select('*')
    .eq('tipo', tipo)
    .eq('ativo', true)
    .single();

  if (error) {
    console.error(`[Templates] Erro ao buscar template ${tipo}:`, error);
    return { data: null, error: error.message };
  }

  return { data: data as TemplateWhatsApp, error: null };
}

// Atualiza um template existente
export async function atualizarTemplate(
  id: string, 
  dados: Partial<Pick<TemplateWhatsApp, 'conteudo' | 'nome' | 'descricao' | 'ativo'>>
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('templates_whatsapp')
    .update(dados)
    .eq('id', id);

  if (error) {
    console.error('[Templates] Erro ao atualizar:', error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
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

// Dados de exemplo para preview
export const dadosExemplo: DadosTemplate = {
  nome: 'João Silva',
  data: '15/01/2025',
  hora: '09:00',
  local: 'Clinicor – Paragominas',
  profissional: 'Dr. Juliano Machado',
  tipo_atendimento: 'Consulta',
  convenio: 'Particular',
};

// Templates padrão (fallback caso não exista no banco)
export const templatesPadrao: Record<string, string> = {
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

// Mapeamento de ícones por tipo de template
export const tipoIcones: Record<string, string> = {
  confirmacao_agendamento: '📋',
  lembrete_24h: '⏰',
  resposta_confirmacao: '✅',
  resposta_cancelamento: '❌',
  reagendamento: '🔄',
  boas_vindas_lead: '👋',
};
