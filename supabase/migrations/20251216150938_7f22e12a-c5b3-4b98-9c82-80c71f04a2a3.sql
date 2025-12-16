-- =============================================
-- FIX ANONYMOUS ACCESS POLICIES
-- Add explicit "TO authenticated" to admin/user-specific policies
-- =============================================

-- 1. AGENDAMENTOS - Admin policies should be TO authenticated
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Admins can update appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Admins can delete appointments" ON public.agendamentos;
DROP POLICY IF EXISTS "Admins can create appointments" ON public.agendamentos;

CREATE POLICY "Admins can view all appointments" 
ON public.agendamentos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update appointments" 
ON public.agendamentos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete appointments" 
ON public.agendamentos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create appointments" 
ON public.agendamentos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. BLOQUEIOS_AGENDA - Admin only
DROP POLICY IF EXISTS "Admins can view bloqueios" ON public.bloqueios_agenda;
DROP POLICY IF EXISTS "Admins can manage bloqueios" ON public.bloqueios_agenda;

CREATE POLICY "Admins can view bloqueios" 
ON public.bloqueios_agenda FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage bloqueios" 
ON public.bloqueios_agenda FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. CLINICAS - Keep public SELECT for booking form, restrict admin to authenticated
DROP POLICY IF EXISTS "Admins can manage clinicas" ON public.clinicas;

CREATE POLICY "Admins can manage clinicas" 
ON public.clinicas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. CONVENIOS - Keep public SELECT for booking form, restrict admin to authenticated
DROP POLICY IF EXISTS "Admins can manage convenios" ON public.convenios;

CREATE POLICY "Admins can manage convenios" 
ON public.convenios FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. DISPONIBILIDADE_ESPECIFICA - Keep public SELECT for booking, restrict admin
DROP POLICY IF EXISTS "Admins can manage disponibilidade_especifica" ON public.disponibilidade_especifica;

CREATE POLICY "Admins can manage disponibilidade_especifica" 
ON public.disponibilidade_especifica FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. DISPONIBILIDADE_SEMANAL - Keep public SELECT for booking, restrict admin
DROP POLICY IF EXISTS "Admins can manage disponibilidade_semanal" ON public.disponibilidade_semanal;
DROP POLICY IF EXISTS "Admins can view all disponibilidade_semanal" ON public.disponibilidade_semanal;

CREATE POLICY "Admins can view all disponibilidade_semanal" 
ON public.disponibilidade_semanal FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage disponibilidade_semanal" 
ON public.disponibilidade_semanal FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 7. GOOGLE_CALENDAR_TOKENS - User-specific, restrict to authenticated
DROP POLICY IF EXISTS "Users can view own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON public.google_calendar_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON public.google_calendar_tokens;

CREATE POLICY "Users can view own tokens" 
ON public.google_calendar_tokens FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own tokens" 
ON public.google_calendar_tokens FOR INSERT TO authenticated
WITH CHECK ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own tokens" 
ON public.google_calendar_tokens FOR UPDATE TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own tokens" 
ON public.google_calendar_tokens FOR DELETE TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- 8. MENSAGENS_WHATSAPP - Admin only
DROP POLICY IF EXISTS "Admins can view all messages" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Admins can insert messages" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Admins can update messages" ON public.mensagens_whatsapp;
DROP POLICY IF EXISTS "Admins can delete messages" ON public.mensagens_whatsapp;

CREATE POLICY "Admins can view all messages" 
ON public.mensagens_whatsapp FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert messages" 
ON public.mensagens_whatsapp FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update messages" 
ON public.mensagens_whatsapp FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete messages" 
ON public.mensagens_whatsapp FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. PROFILES - User-specific
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 10. PROFISSIONAIS - Admin only
DROP POLICY IF EXISTS "Admins can manage profissionais" ON public.profissionais;
DROP POLICY IF EXISTS "Only admins can view profissionais" ON public.profissionais;

CREATE POLICY "Only admins can view profissionais" 
ON public.profissionais FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage profissionais" 
ON public.profissionais FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 11. PROFISSIONAL_CLINICA - Keep public SELECT for booking, restrict admin
DROP POLICY IF EXISTS "Admins can manage profissional_clinica" ON public.profissional_clinica;

CREATE POLICY "Admins can manage profissional_clinica" 
ON public.profissional_clinica FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 12. SERVICOS - Keep public SELECT for booking, restrict admin
DROP POLICY IF EXISTS "Admins can manage servicos" ON public.servicos;

CREATE POLICY "Admins can manage servicos" 
ON public.servicos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 13. TEMPLATES_WHATSAPP - Restrict to admin only (no public need)
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.templates_whatsapp;
DROP POLICY IF EXISTS "Admins can manage templates" ON public.templates_whatsapp;

CREATE POLICY "Admins can view templates" 
ON public.templates_whatsapp FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage templates" 
ON public.templates_whatsapp FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 14. TIPOS_ATENDIMENTO - Keep public SELECT for booking, restrict admin
DROP POLICY IF EXISTS "Admins can manage tipos_atendimento" ON public.tipos_atendimento;

CREATE POLICY "Admins can manage tipos_atendimento" 
ON public.tipos_atendimento FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 15. TWO_FACTOR_AUTH - User-specific
DROP POLICY IF EXISTS "Users can view own 2FA settings" ON public.two_factor_auth;
DROP POLICY IF EXISTS "Users can insert own 2FA settings" ON public.two_factor_auth;
DROP POLICY IF EXISTS "Users can update own 2FA settings" ON public.two_factor_auth;
DROP POLICY IF EXISTS "Users can delete own 2FA settings" ON public.two_factor_auth;

CREATE POLICY "Users can view own 2FA settings" 
ON public.two_factor_auth FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own 2FA settings" 
ON public.two_factor_auth FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own 2FA settings" 
ON public.two_factor_auth FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own 2FA settings" 
ON public.two_factor_auth FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 16. USER_ROLES - Admin + self view only
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;

CREATE POLICY "Admins can view roles" 
ON public.user_roles FOR SELECT TO authenticated
USING ((has_role(auth.uid(), 'admin'::app_role) OR (user_id = auth.uid())));