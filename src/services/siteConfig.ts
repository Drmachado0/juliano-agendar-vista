import { supabase } from "@/integrations/supabase/client";

export interface SiteConfig {
  whatsapp_number: string;
  updated_at: string;
  updated_by: string | null;
}

export async function fetchSiteConfig(): Promise<{
  data: SiteConfig | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase
      .from("site_config" as any)
      .select("whatsapp_number, updated_at, updated_by")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;
    return { data: (data as unknown as SiteConfig) ?? null, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar site_config";
    console.error("[siteConfig] fetch error:", e);
    return { data: null, error: msg };
  }
}

export async function updateWhatsAppNumber(
  whatsapp_number: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("site_config" as any)
      .update({
        whatsapp_number,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw error;
    return { success: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar número";
    console.error("[siteConfig] update error:", e);
    return { success: false, error: msg };
  }
}
