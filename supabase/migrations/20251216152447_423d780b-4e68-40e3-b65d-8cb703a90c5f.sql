-- =====================================================
-- FIX ALL ANONYMOUS ACCESS POLICIES
-- Add TO authenticated to all policies that should require authentication
-- =====================================================

-- =====================================================
-- AGENDAMENTOS - Admin only
-- =====================================================
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

-- =====================================================
-- BLOQUEIOS_AGENDA - Admin only
-- =====================================================
DROP POLICY IF EXISTS "Admins can view bloqueios" ON public.bloqueios_agenda;
DROP POLICY IF EXISTS "Admins can manage bloqueios" ON public.bloqueios_agenda;

CREATE POLICY "Admins can view bloqueios" 
ON public.bloqueios_agenda FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage bloqueios" 
ON public.bloqueios_agenda FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CLINICAS - Public SELECT for booking, Admin for management
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active clinicas" ON public.clinicas;
DROP POLICY IF EXISTS "Admins can manage clinicas" ON public.clinicas;

CREATE POLICY "Public can view active clinicas" 
ON public.clinicas FOR SELECT TO anon, authenticated
USING (ativo = true);

CREATE POLICY "Admins can manage clinicas" 
ON public.clinicas FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CONVENIOS - Public SELECT for booking, Admin for management
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active convenios" ON public.convenios;
DROP POLICY IF EXISTS "Admins can manage convenios" ON public.convenios;

CREATE POLICY "Public can view active convenios" 
ON public.convenios FOR SELECT TO anon, authenticated
USING (ativo = true);

CREATE POLICY "Admins can manage convenios" 
ON public.convenios FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- DISPONIBILIDADE_ESPECIFICA - Public SELECT for booking, Admin for management
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view disponibilidade_especifica" ON public.disponibilidade_especifica;
DROP POLICY IF EXISTS "Admins can manage disponibilidade_especifica" ON public.disponibilidade_especifica;

CREATE POLICY "Public can view disponibilidade_especifica" 
ON public.disponibilidade_especifica FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage disponibilidade_especifica" 
ON public.disponibilidade_especifica FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- DISPONIBILIDADE_SEMANAL - Public SELECT for booking, Admin for management
-- =====================================================
DROP POLICY IF EXISTS "Public can view active disponibilidade_semanal" ON public.disponibilidade_semanal;
DROP POLICY IF EXISTS "Admins can view all disponibilidade_semanal" ON public.disponibilidade_semanal;
DROP POLICY IF EXISTS "Admins can manage disponibilidade_semanal" ON public.disponibilidade_semanal;

CREATE POLICY "Public can view active disponibilidade_semanal" 
ON public.disponibilidade_semanal FOR SELECT TO anon, authenticated
USING (ativo = true);

CREATE POLICY "Admins can manage disponibilidade_semanal" 
ON public.disponibilidade_semanal FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- GOOGLE_CALENDAR_TOKENS - Authenticated users only
-- =====================================================
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

-- =====================================================
-- MENSAGENS_WHATSAPP - Admin only
-- =====================================================
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

-- =====================================================
-- PROFILES - Authenticated users only
-- =====================================================
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

-- =====================================================
-- PROFISSIONAIS - Admin only
-- =====================================================
DROP POLICY IF EXISTS "Only admins can view profissionais" ON public.profissionais;
DROP POLICY IF EXISTS "Admins can manage profissionais" ON public.profissionais;

CREATE POLICY "Admins can view profissionais" 
ON public.profissionais FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage profissionais" 
ON public.profissionais FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- PROFISSIONAL_CLINICA - Public SELECT, Admin for management
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view profissional_clinica" ON public.profissional_clinica;
DROP POLICY IF EXISTS "Admins can manage profissional_clinica" ON public.profissional_clinica;

CREATE POLICY "Public can view profissional_clinica" 
ON public.profissional_clinica FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage profissional_clinica" 
ON public.profissional_clinica FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- SERVICOS - Public SELECT for booking, Admin for management
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active servicos" ON public.servicos;
DROP POLICY IF EXISTS "Admins can manage servicos" ON public.servicos;

CREATE POLICY "Public can view active servicos" 
ON public.servicos FOR SELECT TO anon, authenticated
USING (ativo = true);

CREATE POLICY "Admins can manage servicos" 
ON public.servicos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- TEMPLATES_WHATSAPP - Admin only
-- =====================================================
DROP POLICY IF EXISTS "Admins can view templates" ON public.templates_whatsapp;
DROP POLICY IF EXISTS "Admins can manage templates" ON public.templates_whatsapp;

CREATE POLICY "Admins can view templates" 
ON public.templates_whatsapp FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage templates" 
ON public.templates_whatsapp FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- TIPOS_ATENDIMENTO - Public SELECT for booking, Admin for management
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view active tipos_atendimento" ON public.tipos_atendimento;
DROP POLICY IF EXISTS "Admins can manage tipos_atendimento" ON public.tipos_atendimento;

CREATE POLICY "Public can view active tipos_atendimento" 
ON public.tipos_atendimento FOR SELECT TO anon, authenticated
USING (ativo = true);

CREATE POLICY "Admins can manage tipos_atendimento" 
ON public.tipos_atendimento FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- TWO_FACTOR_AUTH - Authenticated users only
-- =====================================================
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

-- =====================================================
-- USER_ROLES - Authenticated users only
-- =====================================================
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;

CREATE POLICY "Users can view own and admin can view all roles" 
ON public.user_roles FOR SELECT TO authenticated
USING ((has_role(auth.uid(), 'admin'::app_role) OR (user_id = auth.uid())));