import { supabase } from "@/integrations/supabase/client";

export interface VariacaoTemplate {
  id: string;
  template_tipo: string;
  nome: string;
  conteudo: string;
  ativo: boolean;
  peso: number;
  created_at: string;
  updated_at: string;
}

export async function listarVariacoes(tipo: string) {
  const { data, error } = await supabase
    .from("templates_whatsapp_variacoes" as any)
    .select("*")
    .eq("template_tipo", tipo)
    .order("created_at", { ascending: true });
  if (error) return { data: null as VariacaoTemplate[] | null, error: error.message };
  return { data: (data as unknown as VariacaoTemplate[]) ?? [], error: null };
}

export async function criarVariacao(
  v: Pick<VariacaoTemplate, "template_tipo" | "nome" | "conteudo"> &
    Partial<Pick<VariacaoTemplate, "ativo" | "peso">>,
) {
  const { error } = await supabase
    .from("templates_whatsapp_variacoes" as any)
    .insert({ ativo: true, peso: 1, ...v });
  return { success: !error, error: error?.message ?? null };
}

export async function atualizarVariacao(
  id: string,
  patch: Partial<Pick<VariacaoTemplate, "nome" | "conteudo" | "ativo" | "peso">>,
) {
  const { error } = await supabase
    .from("templates_whatsapp_variacoes" as any)
    .update(patch)
    .eq("id", id);
  return { success: !error, error: error?.message ?? null };
}

export async function removerVariacao(id: string) {
  const { error } = await supabase
    .from("templates_whatsapp_variacoes" as any)
    .delete()
    .eq("id", id);
  return { success: !error, error: error?.message ?? null };
}
