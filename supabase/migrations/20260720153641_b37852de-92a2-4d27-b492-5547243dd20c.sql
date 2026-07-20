-- Bloco 4: Higiene de SECURITY DEFINER
-- 1) Views: forçar security_invoker (respeita RLS de quem consulta)
ALTER VIEW public.vw_crm_leads_atencao SET (security_invoker = true);
ALTER VIEW public.v_saude_integracoes SET (security_invoker = true);

-- 2) Revogar EXECUTE de anon/public em funções trigger/cron/internas
--    (triggers rodam como owner; cron chama via service_role; nenhuma exposição pública necessária)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_observacoes_trigger() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_assign_first_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_site_config_pixel_change() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.arquivar_agendamentos_antigos() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_compareceu_vencidos() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_disparar_lembretes_d1() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_emit_event(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_google_calendar_pull() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_agendamento_needs_human_fn() FROM anon, PUBLIC;

-- 3) Revogar anon em RPCs de admin (front autenticado usa role 'authenticated'; guard has_role interno mantém)
REVOKE EXECUTE ON FUNCTION public.exportar_dados_paciente(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.detectar_duplicados_telefone() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.listar_crm_audit(text, text, uuid, text, text, timestamptz, timestamptz, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.listar_crm_audit_users() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.relatorio_diario(date, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_agendamento_sandbox(uuid, boolean, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reativar_bot_agendamento(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.info_secret_integracao(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rotacionar_secret_integracao(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.saude_integracoes() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vincular_mensagens_orfas(boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lgpd_log(text, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lgpd_check_rate_limit(text, integer) FROM anon, PUBLIC;

-- 4) ler_secret_integracao só deve ser chamada por service_role (guard já existe internamente)
REVOKE EXECUTE ON FUNCTION public.ler_secret_integracao(text) FROM anon, PUBLIC, authenticated;