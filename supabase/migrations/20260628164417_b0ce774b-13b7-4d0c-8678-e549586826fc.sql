
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.agendamentos;
CREATE POLICY "Admins can view all appointments" ON public.agendamentos
  FOR SELECT USING (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can create appointments" ON public.agendamentos;
CREATE POLICY "Admins can create appointments" ON public.agendamentos
  FOR INSERT WITH CHECK (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update appointments" ON public.agendamentos;
CREATE POLICY "Admins can update appointments" ON public.agendamentos
  FOR UPDATE USING (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can delete appointments" ON public.agendamentos;
CREATE POLICY "Admins can delete appointments" ON public.agendamentos
  FOR DELETE USING (public.has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all messages" ON public.mensagens_whatsapp;
CREATE POLICY "Admins can view all messages" ON public.mensagens_whatsapp
  FOR SELECT USING (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert messages" ON public.mensagens_whatsapp;
CREATE POLICY "Admins can insert messages" ON public.mensagens_whatsapp
  FOR INSERT WITH CHECK (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update messages" ON public.mensagens_whatsapp;
CREATE POLICY "Admins can update messages" ON public.mensagens_whatsapp
  FOR UPDATE USING (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can delete messages" ON public.mensagens_whatsapp;
CREATE POLICY "Admins can delete messages" ON public.mensagens_whatsapp
  FOR DELETE USING (public.has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view lembretes_anuais" ON public.lembretes_anuais;
CREATE POLICY "Admins can view lembretes_anuais" ON public.lembretes_anuais
  FOR SELECT USING (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert lembretes_anuais" ON public.lembretes_anuais;
CREATE POLICY "Admins can insert lembretes_anuais" ON public.lembretes_anuais
  FOR INSERT WITH CHECK (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update lembretes_anuais" ON public.lembretes_anuais;
CREATE POLICY "Admins can update lembretes_anuais" ON public.lembretes_anuais
  FOR UPDATE USING (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can delete lembretes_anuais" ON public.lembretes_anuais;
CREATE POLICY "Admins can delete lembretes_anuais" ON public.lembretes_anuais
  FOR DELETE USING (public.has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can manage verificacoes_whatsapp" ON public.verificacoes_whatsapp;
CREATE POLICY "Admins can manage verificacoes_whatsapp" ON public.verificacoes_whatsapp
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view audit log" ON public.crm_audit_log;
CREATE POLICY "Admins can view audit log" ON public.crm_audit_log
  FOR SELECT USING (public.has_role((select auth.uid()), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.crm_audit_log;
CREATE POLICY "Admins can insert audit log" ON public.crm_audit_log
  FOR INSERT WITH CHECK (public.has_role((select auth.uid()), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_agendamentos_servico_id ON public.agendamentos(servico_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional_id ON public.agendamentos(profissional_id);
CREATE INDEX IF NOT EXISTS idx_bloqueios_agenda_clinica_id ON public.bloqueios_agenda(clinica_id);
CREATE INDEX IF NOT EXISTS idx_bloqueios_agenda_profissional_id ON public.bloqueios_agenda(profissional_id);
CREATE INDEX IF NOT EXISTS idx_bot_assistente_log_mensagem_id ON public.bot_assistente_log(mensagem_id);
CREATE INDEX IF NOT EXISTS idx_conversation_intents_mensagem_id ON public.conversation_intents(mensagem_id);
CREATE INDEX IF NOT EXISTS idx_disponibilidade_especifica_modelo_id ON public.disponibilidade_especifica(modelo_id);
CREATE INDEX IF NOT EXISTS idx_profissional_clinica_clinica_id ON public.profissional_clinica(clinica_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data_local ON public.agendamentos(data_agendamento, local_atendimento);
