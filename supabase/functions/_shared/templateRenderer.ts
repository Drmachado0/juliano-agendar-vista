import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  DadosTemplate,
  renderizarTemplate,
  templatesPadrao,
  formatarData,
  formatarHora,
} from "./templateTexto.ts";

// As peças puras vivem em `templateTexto.ts` para poderem ser testadas sem
// Deno nem rede. Reexportadas aqui para não quebrar quem já importa daqui.
export {
  renderizarTemplate,
  templatesPadrao,
  formatarData,
  formatarHora,
};
export type { DadosTemplate };

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

// Busca e renderiza template em uma única chamada
export async function gerarMensagemDoTemplate(
  tipo: string,
  dados: DadosTemplate
): Promise<string> {
  const template = await buscarTemplate(tipo);
  return renderizarTemplate(template, dados);
}
