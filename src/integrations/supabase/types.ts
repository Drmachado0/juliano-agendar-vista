export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          aceita_contato_whatsapp_email: boolean | null
          aceita_primeiro_horario: boolean | null
          bot_ativo: boolean
          bot_pausa_motivo: string | null
          bot_pausado_ate: string | null
          bot_pausado_por: string | null
          bot_ultima_acao_at: string | null
          clinica_id: string | null
          confirmacao_enviada: boolean | null
          confirmation_channel: string | null
          confirmation_response_at: string | null
          confirmation_sent_at: string | null
          confirmation_status: string | null
          convenio: string
          convenio_outro: string | null
          created_at: string | null
          data_agendamento: string | null
          data_nascimento: string | null
          detalhe_exame_ou_cirurgia: string | null
          email: string | null
          google_calendar_etag: string | null
          google_calendar_event_id: string | null
          google_calendar_synced_at: string | null
          hora_agendamento: string | null
          id: string
          is_sandbox: boolean
          local_atendimento: string
          nome_completo: string
          observacoes_internas: string | null
          observacoes_internas_encrypted: string | null
          origem: string | null
          profissional_id: string | null
          sandbox_reason: string | null
          servico_id: string | null
          status_crm: string
          status_funil: string | null
          telefone_whatsapp: string
          tipo_atendimento: string
          updated_at: string | null
        }
        Insert: {
          aceita_contato_whatsapp_email?: boolean | null
          aceita_primeiro_horario?: boolean | null
          bot_ativo?: boolean
          bot_pausa_motivo?: string | null
          bot_pausado_ate?: string | null
          bot_pausado_por?: string | null
          bot_ultima_acao_at?: string | null
          clinica_id?: string | null
          confirmacao_enviada?: boolean | null
          confirmation_channel?: string | null
          confirmation_response_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_status?: string | null
          convenio: string
          convenio_outro?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          data_nascimento?: string | null
          detalhe_exame_ou_cirurgia?: string | null
          email?: string | null
          google_calendar_etag?: string | null
          google_calendar_event_id?: string | null
          google_calendar_synced_at?: string | null
          hora_agendamento?: string | null
          id?: string
          is_sandbox?: boolean
          local_atendimento: string
          nome_completo: string
          observacoes_internas?: string | null
          observacoes_internas_encrypted?: string | null
          origem?: string | null
          profissional_id?: string | null
          sandbox_reason?: string | null
          servico_id?: string | null
          status_crm?: string
          status_funil?: string | null
          telefone_whatsapp: string
          tipo_atendimento: string
          updated_at?: string | null
        }
        Update: {
          aceita_contato_whatsapp_email?: boolean | null
          aceita_primeiro_horario?: boolean | null
          bot_ativo?: boolean
          bot_pausa_motivo?: string | null
          bot_pausado_ate?: string | null
          bot_pausado_por?: string | null
          bot_ultima_acao_at?: string | null
          clinica_id?: string | null
          confirmacao_enviada?: boolean | null
          confirmation_channel?: string | null
          confirmation_response_at?: string | null
          confirmation_sent_at?: string | null
          confirmation_status?: string | null
          convenio?: string
          convenio_outro?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          data_nascimento?: string | null
          detalhe_exame_ou_cirurgia?: string | null
          email?: string | null
          google_calendar_etag?: string | null
          google_calendar_event_id?: string | null
          google_calendar_synced_at?: string | null
          hora_agendamento?: string | null
          id?: string
          is_sandbox?: boolean
          local_atendimento?: string
          nome_completo?: string
          observacoes_internas?: string | null
          observacoes_internas_encrypted?: string | null
          origem?: string | null
          profissional_id?: string | null
          sandbox_reason?: string | null
          servico_id?: string | null
          status_crm?: string
          status_funil?: string | null
          telefone_whatsapp?: string
          tipo_atendimento?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_google: {
        Row: {
          ativo: boolean | null
          author_name: string
          author_photo_url: string | null
          created_at: string | null
          google_review_id: string
          id: string
          language: string | null
          rating: number
          relative_time_description: string | null
          text: string | null
          time_epoch: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          author_name: string
          author_photo_url?: string | null
          created_at?: string | null
          google_review_id: string
          id?: string
          language?: string | null
          rating: number
          relative_time_description?: string | null
          text?: string | null
          time_epoch?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          author_name?: string
          author_photo_url?: string | null
          created_at?: string | null
          google_review_id?: string
          id?: string
          language?: string | null
          rating?: number
          relative_time_description?: string | null
          text?: string | null
          time_epoch?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bloqueios_agenda: {
        Row: {
          clinica_id: string
          created_at: string | null
          data: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          motivo: string | null
          profissional_id: string | null
          tipo_bloqueio: string
          updated_at: string | null
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          data: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          profissional_id?: string | null
          tipo_bloqueio: string
          updated_at?: string | null
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          data?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          profissional_id?: string | null
          tipo_bloqueio?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bloqueios_agenda_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueios_agenda_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_assistente_log: {
        Row: {
          acao: string
          agendamento_id: string | null
          created_at: string
          detalhes: Json | null
          id: string
          intencao: string | null
          latencia_ms: number | null
          mensagem_id: string | null
          telefone: string
        }
        Insert: {
          acao: string
          agendamento_id?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          intencao?: string | null
          latencia_ms?: number | null
          mensagem_id?: string | null
          telefone: string
        }
        Update: {
          acao?: string
          agendamento_id?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          intencao?: string | null
          latencia_ms?: number | null
          mensagem_id?: string | null
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_assistente_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_assistente_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_assistente_log_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens_whatsapp"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_config: {
        Row: {
          id: boolean
          pausa_automatica_ativa: boolean
          pausa_automatica_minutos: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          pausa_automatica_ativa?: boolean
          pausa_automatica_minutos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          pausa_automatica_ativa?: boolean
          pausa_automatica_minutos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      clinicas: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          endereco: string | null
          id: string
          nome: string
          slug: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome: string
          slug: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          slug?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      convenios: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          slug: string
          updated_at: string | null
          valor_consulta: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          slug: string
          updated_at?: string | null
          valor_consulta?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          slug?: string
          updated_at?: string | null
          valor_consulta?: number | null
        }
        Relationships: []
      }
      conversation_intents: {
        Row: {
          agendamento_id: string | null
          confianca: number | null
          created_at: string
          id: string
          intencao: string
          mensagem_id: string | null
          modelo: string
          proxima_acao: string | null
          raw_output: Json | null
          resumo: string | null
          sentimento: string | null
          telefone: string
        }
        Insert: {
          agendamento_id?: string | null
          confianca?: number | null
          created_at?: string
          id?: string
          intencao: string
          mensagem_id?: string | null
          modelo?: string
          proxima_acao?: string | null
          raw_output?: Json | null
          resumo?: string | null
          sentimento?: string | null
          telefone: string
        }
        Update: {
          agendamento_id?: string | null
          confianca?: number | null
          created_at?: string
          id?: string
          intencao?: string
          mensagem_id?: string | null
          modelo?: string
          proxima_acao?: string | null
          raw_output?: Json | null
          resumo?: string | null
          sentimento?: string | null
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_intents_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_intents_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_intents_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens_whatsapp"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_audit_log: {
        Row: {
          acao: string
          agendamento_id: string | null
          created_at: string
          detalhes: Json | null
          id: string
          status_anterior: string | null
          status_novo: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          acao: string
          agendamento_id?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          status_anterior?: string | null
          status_novo?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          acao?: string
          agendamento_id?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          status_anterior?: string | null
          status_novo?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_audit_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_audit_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidade_especifica: {
        Row: {
          clinica_id: string | null
          created_at: string | null
          data: string
          disponivel: boolean | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          intervalo_minutos: number | null
          motivo: string | null
          updated_at: string | null
        }
        Insert: {
          clinica_id?: string | null
          created_at?: string | null
          data: string
          disponivel?: boolean | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          intervalo_minutos?: number | null
          motivo?: string | null
          updated_at?: string | null
        }
        Update: {
          clinica_id?: string | null
          created_at?: string | null
          data?: string
          disponivel?: boolean | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          intervalo_minutos?: number | null
          motivo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidade_especifica_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilidade_semanal: {
        Row: {
          ativo: boolean | null
          clinica_id: string | null
          created_at: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          intervalo_minutos: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          clinica_id?: string | null
          created_at?: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          intervalo_minutos?: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          clinica_id?: string | null
          created_at?: string | null
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          intervalo_minutos?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disponibilidade_semanal_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_settings: {
        Row: {
          auto_sync_enabled: boolean
          created_at: string | null
          default_duration_min: number
          default_import_clinica_id: string | null
          event_color_id: string | null
          id: string
          include_convenio: boolean
          include_patient_phone: boolean
          reminder_popup_min: number[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_sync_enabled?: boolean
          created_at?: string | null
          default_duration_min?: number
          default_import_clinica_id?: string | null
          event_color_id?: string | null
          id?: string
          include_convenio?: boolean
          include_patient_phone?: boolean
          reminder_popup_min?: number[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_sync_enabled?: boolean
          created_at?: string | null
          default_duration_min?: number
          default_import_clinica_id?: string | null
          event_color_id?: string | null
          id?: string
          include_convenio?: boolean
          include_patient_phone?: boolean
          reminder_popup_min?: number[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          connected_at: string | null
          created_at: string | null
          google_email: string | null
          id: string
          last_pull_at: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          pull_enabled: boolean
          refresh_token: string
          sync_token: string | null
          time_zone: string | null
          token_expiry: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          connected_at?: string | null
          created_at?: string | null
          google_email?: string | null
          id?: string
          last_pull_at?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          pull_enabled?: boolean
          refresh_token: string
          sync_token?: string | null
          time_zone?: string | null
          token_expiry: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          connected_at?: string | null
          created_at?: string | null
          google_email?: string | null
          id?: string
          last_pull_at?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          pull_enabled?: boolean
          refresh_token?: string
          sync_token?: string | null
          time_zone?: string | null
          token_expiry?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hermes_conversation_state: {
        Row: {
          ambiguous_count: number
          available_slots: Json | null
          awaiting: string | null
          convenio: string | null
          created_at: string
          data_nascimento: string | null
          id: string
          last_intent: string | null
          last_options: Json | null
          lead_id: string | null
          nome_completo: string | null
          payment_type: string | null
          pending_confirmation: boolean
          phone: string
          sandbox: boolean
          selected_data: string | null
          selected_local: string | null
          selected_periodo: string | null
          updated_at: string
        }
        Insert: {
          ambiguous_count?: number
          available_slots?: Json | null
          awaiting?: string | null
          convenio?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          last_intent?: string | null
          last_options?: Json | null
          lead_id?: string | null
          nome_completo?: string | null
          payment_type?: string | null
          pending_confirmation?: boolean
          phone: string
          sandbox?: boolean
          selected_data?: string | null
          selected_local?: string | null
          selected_periodo?: string | null
          updated_at?: string
        }
        Update: {
          ambiguous_count?: number
          available_slots?: Json | null
          awaiting?: string | null
          convenio?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          last_intent?: string | null
          last_options?: Json | null
          lead_id?: string | null
          nome_completo?: string | null
          payment_type?: string | null
          pending_confirmation?: boolean
          phone?: string
          sandbox?: boolean
          selected_data?: string | null
          selected_local?: string | null
          selected_periodo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hermes_drafts: {
        Row: {
          acoes_sugeridas: Json | null
          agendamento_id: string | null
          conteudo_final: string | null
          contexto_resumo: Json | null
          created_at: string
          created_by: string | null
          id: string
          instrucao: string | null
          latencia_ms: number | null
          mensagem_id: string | null
          modelo: string
          status: string
          sugestao: string
          telefone: string | null
          tipo_origem: string
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          acoes_sugeridas?: Json | null
          agendamento_id?: string | null
          conteudo_final?: string | null
          contexto_resumo?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          instrucao?: string | null
          latencia_ms?: number | null
          mensagem_id?: string | null
          modelo?: string
          status?: string
          sugestao: string
          telefone?: string | null
          tipo_origem?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          acoes_sugeridas?: Json | null
          agendamento_id?: string | null
          conteudo_final?: string | null
          contexto_resumo?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          instrucao?: string | null
          latencia_ms?: number | null
          mensagem_id?: string | null
          modelo?: string
          status?: string
          sugestao?: string
          telefone?: string | null
          tipo_origem?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hermes_drafts_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hermes_drafts_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hermes_drafts_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens_whatsapp"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_disponiveis: {
        Row: {
          created_at: string | null
          data: string
          disponivel: boolean | null
          hora: string
          id: string
          local: string
        }
        Insert: {
          created_at?: string | null
          data: string
          disponivel?: boolean | null
          hora: string
          id?: string
          local: string
        }
        Update: {
          created_at?: string | null
          data?: string
          disponivel?: boolean | null
          hora?: string
          id?: string
          local?: string
        }
        Relationships: []
      }
      lembretes_anuais: {
        Row: {
          created_at: string | null
          data_proximo_lembrete: string | null
          data_ultima_consulta: string
          id: string
          lembrete_enviado: boolean | null
          lembrete_enviado_em: string | null
          nome: string
          origem: string | null
          primeiro_nome: string | null
          telefone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_proximo_lembrete?: string | null
          data_ultima_consulta: string
          id?: string
          lembrete_enviado?: boolean | null
          lembrete_enviado_em?: string | null
          nome: string
          origem?: string | null
          primeiro_nome?: string | null
          telefone: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_proximo_lembrete?: string | null
          data_ultima_consulta?: string
          id?: string
          lembrete_enviado?: boolean | null
          lembrete_enviado_em?: string | null
          nome?: string
          origem?: string | null
          primeiro_nome?: string | null
          telefone?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lgpd_rate_limit: {
        Row: {
          acao: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      mensagens_whatsapp: {
        Row: {
          agendamento_id: string | null
          conteudo: string
          created_at: string
          direcao: string
          error_message: string | null
          id: string
          lida: boolean | null
          mensagem_externa_id: string | null
          payload: Json | null
          status_envio: string | null
          telefone: string
          tipo_mensagem: string | null
        }
        Insert: {
          agendamento_id?: string | null
          conteudo: string
          created_at?: string
          direcao: string
          error_message?: string | null
          id?: string
          lida?: boolean | null
          mensagem_externa_id?: string | null
          payload?: Json | null
          status_envio?: string | null
          telefone: string
          tipo_mensagem?: string | null
        }
        Update: {
          agendamento_id?: string | null
          conteudo?: string
          created_at?: string
          direcao?: string
          error_message?: string | null
          id?: string
          lida?: boolean | null
          mensagem_externa_id?: string | null
          payload?: Json | null
          status_envio?: string | null
          telefone?: string
          tipo_mensagem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_whatsapp_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_whatsapp_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          ativo: boolean | null
          cargo: string | null
          created_at: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profissional_clinica: {
        Row: {
          clinica_id: string
          created_at: string | null
          id: string
          profissional_id: string
        }
        Insert: {
          clinica_id: string
          created_at?: string | null
          id?: string
          profissional_id: string
        }
        Update: {
          clinica_id?: string
          created_at?: string | null
          id?: string
          profissional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_clinica_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_clinica_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          duracao_min: number
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          duracao_min?: number
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          duracao_min?: number
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      status_acesso_log: {
        Row: {
          agendamento_id: string
          confirmation_status: string | null
          created_at: string
          id: string
          ip_address: string | null
          referer: string | null
          status_exibido: string | null
          status_funil: string | null
          user_agent: string | null
        }
        Insert: {
          agendamento_id: string
          confirmation_status?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          referer?: string | null
          status_exibido?: string | null
          status_funil?: string | null
          user_agent?: string | null
        }
        Update: {
          agendamento_id?: string
          confirmation_status?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          referer?: string | null
          status_exibido?: string | null
          status_funil?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          agendamento_id: string | null
          category: string
          created_at: string
          details: Json | null
          id: string
          level: string
          message: string
          request_id: string | null
          source: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          agendamento_id?: string | null
          category: string
          created_at?: string
          details?: Json | null
          id?: string
          level: string
          message: string
          request_id?: string | null
          source: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          agendamento_id?: string | null
          category?: string
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message?: string
          request_id?: string | null
          source?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      templates_whatsapp: {
        Row: {
          ativo: boolean | null
          conteudo: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string | null
          variaveis_disponiveis: string[] | null
        }
        Insert: {
          ativo?: boolean | null
          conteudo: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string | null
          variaveis_disponiveis?: string[] | null
        }
        Update: {
          ativo?: boolean | null
          conteudo?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string | null
          variaveis_disponiveis?: string[] | null
        }
        Relationships: []
      }
      tipos_atendimento: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      two_factor_auth: {
        Row: {
          backup_codes_encrypted: string | null
          backup_codes_used: string[] | null
          created_at: string | null
          id: string
          totp_enabled: boolean | null
          totp_secret_encrypted: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          backup_codes_encrypted?: string | null
          backup_codes_used?: string[] | null
          created_at?: string | null
          id?: string
          totp_enabled?: boolean | null
          totp_secret_encrypted?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          backup_codes_encrypted?: string | null
          backup_codes_used?: string[] | null
          created_at?: string | null
          id?: string
          totp_enabled?: boolean | null
          totp_secret_encrypted?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verificacoes_whatsapp: {
        Row: {
          created_at: string | null
          existe_whatsapp: boolean
          id: string
          jid: string | null
          telefone: string
          updated_at: string | null
          verificado_em: string
        }
        Insert: {
          created_at?: string | null
          existe_whatsapp: boolean
          id?: string
          jid?: string | null
          telefone: string
          updated_at?: string | null
          verificado_em?: string
        }
        Update: {
          created_at?: string | null
          existe_whatsapp?: boolean
          id?: string
          jid?: string | null
          telefone?: string
          updated_at?: string | null
          verificado_em?: string
        }
        Relationships: []
      }
    }
    Views: {
      pacientes: {
        Row: {
          convenio: string | null
          id: string | null
          nome: string | null
          phone_number: string | null
          tags: string | null
          total_atendimentos: number | null
          total_mensagens: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apagar_dados_paciente: {
        Args: { p_confirmar?: boolean; p_telefone: string }
        Returns: Json
      }
      aplicar_retencao_lgpd: { Args: never; Returns: Json }
      buscar_agendamento_por_telefone: {
        Args: { p_telefone: string }
        Returns: {
          created_at: string
          id: string
          is_sandbox: boolean
          local_atendimento: string
          nome_completo: string
          status_crm: string
          status_funil: string
          telefone_whatsapp: string
        }[]
      }
      buscar_paciente: {
        Args: { p_phone_number: string }
        Returns: {
          id: string
          nome: string
          phone_number: string
        }[]
      }
      criar_agendamento: {
        Args: {
          p_convenio?: string
          p_data: string
          p_hora: string
          p_local: string
          p_nome_paciente: string
          p_phone_number: string
        }
        Returns: {
          agendamento_id: string
          mensagem: string
          sucesso: boolean
        }[]
      }
      criar_lead_manual_whatsapp: {
        Args: {
          p_is_sandbox?: boolean
          p_nome: string
          p_observacoes?: string
          p_telefone: string
        }
        Returns: string
      }
      decrypt_sensitive_data: {
        Args: { encrypted_data: string }
        Returns: string
      }
      decrypt_totp_secret: {
        Args: { encrypted_secret: string }
        Returns: string
      }
      detectar_duplicados_telefone: {
        Args: never
        Returns: {
          agendamentos: Json
          telefone_normalizado: string
          total_duplicados: number
        }[]
      }
      encrypt_sensitive_data: { Args: { plain_text: string }; Returns: string }
      encrypt_totp_secret: { Args: { plain_secret: string }; Returns: string }
      exportar_dados_paciente: { Args: { p_telefone: string }; Returns: Json }
      get_observacoes_decrypted: {
        Args: { agendamento_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      horarios_ocupados: {
        Args: {
          p_clinica_ids?: string[]
          p_data_fim: string
          p_data_inicio: string
        }
        Returns: {
          clinica_id: string
          data_agendamento: string
          hora_agendamento: string
        }[]
      }
      lgpd_check_rate_limit: {
        Args: { p_acao: string; p_limite?: number }
        Returns: undefined
      }
      lgpd_log: {
        Args: { p_acao: string; p_detalhes: Json; p_telefone: string }
        Returns: undefined
      }
      listar_crm_audit: {
        Args: {
          p_acao?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_limit?: number
          p_search?: string
          p_status_anterior?: string
          p_status_novo?: string
          p_user_id?: string
        }
        Returns: {
          acao: string
          agendamento_id: string
          created_at: string
          detalhes: Json
          id: string
          paciente_nome: string
          paciente_telefone: string
          status_anterior: string
          status_novo: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      listar_crm_audit_users: {
        Args: never
        Returns: {
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      listar_horarios_disponiveis: {
        Args: { p_data: string; p_local: string }
        Returns: {
          data: string
          disponivel: boolean
          hora: string
          id: string
          local: string
        }[]
      }
      listar_system_logs: {
        Args: {
          p_category?: string
          p_data_fim?: string
          p_data_inicio?: string
          p_level?: string
          p_limit?: number
          p_search?: string
          p_source?: string
          p_user_id?: string
        }
        Returns: {
          agendamento_id: string
          category: string
          created_at: string
          details: Json
          id: string
          level: string
          message: string
          request_id: string
          source: string
          user_email: string
          user_id: string
        }[]
      }
      marcar_hermes_draft_status: {
        Args: {
          p_conteudo_final?: string
          p_draft_id: string
          p_mensagem_id?: string
          p_status: string
        }
        Returns: undefined
      }
      mask_email: { Args: { p_email: string }; Returns: string }
      mask_nome: { Args: { p_nome: string }; Returns: string }
      mask_telefone: { Args: { p_tel: string }; Returns: string }
      normalizar_telefone: { Args: { p_telefone: string }; Returns: string }
      pausar_bot_agendamento: {
        Args: {
          p_agendamento_id: string
          p_minutos?: number
          p_motivo?: string
        }
        Returns: string
      }
      preview_dados_paciente: { Args: { p_telefone: string }; Returns: Json }
      reativar_bot_agendamento: {
        Args: { p_agendamento_id: string }
        Returns: undefined
      }
      registrar_bot_log: {
        Args: {
          p_acao: string
          p_agendamento_id?: string
          p_detalhes?: Json
          p_intencao?: string
          p_latencia_ms?: number
          p_mensagem_id?: string
          p_telefone: string
        }
        Returns: string
      }
      registrar_crm_audit: {
        Args: {
          p_acao: string
          p_agendamento_id: string
          p_detalhes?: Json
          p_status_anterior?: string
          p_status_novo?: string
        }
        Returns: string
      }
      registrar_mensagem: {
        Args: {
          p_conteudo: string
          p_direcao: string
          p_message_id?: string
          p_metadata?: Json
          p_nome: string
          p_phone_number: string
          p_remote_jid: string
          p_tipo_mensagem?: string
        }
        Returns: undefined
      }
      registrar_mensagem_whatsapp: {
        Args: {
          p_agendamento_id?: string
          p_conteudo: string
          p_direcao: string
          p_error_message?: string
          p_mensagem_externa_id?: string
          p_payload?: Json
          p_status_envio?: string
          p_telefone: string
          p_tipo_mensagem?: string
        }
        Returns: string
      }
      registrar_system_log: {
        Args: {
          p_agendamento_id?: string
          p_category: string
          p_details?: Json
          p_level: string
          p_message: string
          p_request_id?: string
          p_source: string
        }
        Returns: string
      }
      relatorio_diario: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: Json
      }
      relatorio_diario_serie: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: {
          dia: string
          drafts_gerados: number
          leads_novos: number
          msg_in: number
          msg_out: number
        }[]
      }
      set_agendamento_sandbox: {
        Args: {
          p_agendamento_id: string
          p_is_sandbox: boolean
          p_reason?: string
        }
        Returns: undefined
      }
      setup_totp: {
        Args: { p_backup_codes: string; p_secret: string; p_user_id: string }
        Returns: undefined
      }
      trigger_google_calendar_pull: { Args: never; Returns: undefined }
      unificar_duplicados: {
        Args: { p_principal_id?: string; p_telefone_normalizado: string }
        Returns: Json
      }
      validar_horario: {
        Args: { p_data: string; p_hora: string; p_local: string }
        Returns: {
          disponivel: boolean
          mensagem: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      status_crm_enum: "NOVO LEAD" | "CLINICOR" | "HGP" | "BELÉM"
      status_funil_enum: "lead" | "agendado" | "confirmado" | "cancelado"
      tipo_atendimento_enum: "Consulta" | "Retorno" | "Exame" | "Cirurgia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      status_crm_enum: ["NOVO LEAD", "CLINICOR", "HGP", "BELÉM"],
      status_funil_enum: ["lead", "agendado", "confirmado", "cancelado"],
      tipo_atendimento_enum: ["Consulta", "Retorno", "Exame", "Cirurgia"],
    },
  },
} as const
