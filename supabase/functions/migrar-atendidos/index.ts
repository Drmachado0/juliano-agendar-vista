import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔄 Iniciando migração automática para ATENDIDO...");

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    console.log(`📅 Buscando agendamentos em HGP/CLINICOR com updated_at anterior a ${cutoffDate}`);

    // Find appointments in HGP or CLINICOR with updated_at > 30 days ago
    const { data: agendamentosParaMigrar, error: selectError } = await supabaseAdmin
      .from("agendamentos")
      .select("id, nome_completo, status_crm, updated_at")
      .in("status_crm", ["HGP", "CLINICOR"])
      .lt("updated_at", cutoffDate);

    if (selectError) {
      console.error("❌ Erro ao buscar agendamentos:", selectError);
      throw selectError;
    }

    if (!agendamentosParaMigrar || agendamentosParaMigrar.length === 0) {
      console.log("✅ Nenhum agendamento para migrar");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum agendamento para migrar",
          migrated: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Encontrados ${agendamentosParaMigrar.length} agendamentos para migrar`);

    // Update each appointment to ATENDIDO
    const ids = agendamentosParaMigrar.map(a => a.id);
    
    const { error: updateError } = await supabaseAdmin
      .from("agendamentos")
      .update({ 
        status_crm: "ATENDIDO", 
        updated_at: new Date().toISOString() 
      })
      .in("id", ids);

    if (updateError) {
      console.error("❌ Erro ao atualizar agendamentos:", updateError);
      throw updateError;
    }

    console.log(`✅ ${agendamentosParaMigrar.length} agendamentos migrados para ATENDIDO`);

    // Log details for debugging
    agendamentosParaMigrar.forEach(a => {
      console.log(`  - ${a.nome_completo} (${a.status_crm} → ATENDIDO)`);
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${agendamentosParaMigrar.length} agendamentos migrados para ATENDIDO`,
        migrated: agendamentosParaMigrar.length,
        details: agendamentosParaMigrar.map(a => ({
          id: a.id,
          nome: a.nome_completo,
          statusAnterior: a.status_crm
        }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro ao migrar agendamentos";
    console.error("❌ Erro na migração:", errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
