-- 1. View passa a usar as permissões de quem consulta (security invoker)
ALTER VIEW public.vw_crm_leads_atencao SET (security_invoker = true);

-- 2. agendamentos / mensagens_whatsapp / crm_audit_log: restringir ao papel authenticated
--    e remover qualquer privilégio do papel anônimo (também vale para Realtime).
REVOKE ALL ON public.agendamentos FROM anon;
REVOKE ALL ON public.mensagens_whatsapp FROM anon;
REVOKE ALL ON public.crm_audit_log FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensagens_whatsapp TO authenticated;
GRANT ALL ON public.mensagens_whatsapp TO service_role;
GRANT SELECT, INSERT ON public.crm_audit_log TO authenticated;
GRANT ALL ON public.crm_audit_log TO service_role;

DROP POLICY IF EXISTS "Admins can view all appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Admins can create appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Admins can update appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Admins can delete appointments" ON public.agendamentos;

CREATE POLICY "Admins can view all appointments" ON public.agendamentos
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can create appointments" ON public.agendamentos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update appointments" ON public.agendamentos
  FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete appointments" ON public.agendamentos
  FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all messages" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Admins can insert messages" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Admins can update messages" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Admins can delete messages" ON public.mensagens_whatsapp;

CREATE POLICY "Admins can view all messages" ON public.mensagens_whatsapp
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert messages" ON public.mensagens_whatsapp
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can update messages" ON public.mensagens_whatsapp
  FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can delete messages" ON public.mensagens_whatsapp
  FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view audit log" ON public.crm_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.crm_audit_log;

CREATE POLICY "Admins can view audit log" ON public.crm_audit_log
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));
CREATE POLICY "Admins can insert audit log" ON public.crm_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- 3. disponibilidade_especifica: remover leitura pública (site público lê via
--    edge functions com service_role, que já filtram o que é publicável).
DROP POLICY IF EXISTS "Public can view disponibilidade_especifica" ON public.disponibilidade_especifica;
REVOKE ALL ON public.disponibilidade_especifica FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disponibilidade_especifica TO authenticated;
GRANT ALL ON public.disponibilidade_especifica TO service_role;

-- 4. profissional_clinica: mapeamento interno, somente administradores.
DROP POLICY IF EXISTS "Public can view profissional_clinica" ON public.profissional_clinica;
REVOKE ALL ON public.profissional_clinica FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissional_clinica TO authenticated;
GRANT ALL ON public.profissional_clinica TO service_role;