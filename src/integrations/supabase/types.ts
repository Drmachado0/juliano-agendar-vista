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
          estado_atendimento: string
          event_id: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gbraid: string | null
          gclid: string | null
          google_calendar_etag: string | null
          google_calendar_event_id: string | null
          google_calendar_synced_at: string | null
          hora_agendamento: string | null
          id: string
          is_sandbox: boolean
          landing_page: string | null
          local_atendimento: string
          motivo_status: string | null
          nome_completo: string
          observacoes_internas: string | null
          observacoes_internas_encrypted: string | null
          origem: string | null
          profissional_id: string | null
          referrer: string | null
          sandbox_reason: string | null
          servico_id: string | null
          status_crm: string
          status_funil: string | null
          telefone_canonico: string | null
          telefone_whatsapp: string
          tipo_atendimento: string
          ultimo_followup_em: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          wbraid: string | null
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
          estado_atendimento?: string
          event_id?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gbraid?: string | null
          gclid?: string | null
          google_calendar_etag?: string | null
          google_calendar_event_id?: string | null
          google_calendar_synced_at?: string | null
          hora_agendamento?: string | null
          id?: string
          is_sandbox?: boolean
          landing_page?: string | null
          local_atendimento: string
          motivo_status?: string | null
          nome_completo: string
          observacoes_internas?: string | null
          observacoes_internas_encrypted?: string | null
          origem?: string | null
          profissional_id?: string | null
          referrer?: string | null
          sandbox_reason?: string | null
          servico_id?: string | null
          status_crm?: string
          status_funil?: string | null
          telefone_canonico?: string | null
          telefone_whatsapp: string
          tipo_atendimento: string
          ultimo_followup_em?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wbraid?: string | null
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
          estado_atendimento?: string
          event_id?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          gbraid?: string | null
          gclid?: string | null
          google_calendar_etag?: string | null
          google_calendar_event_id?: string | null
          google_calendar_synced_at?: string | null
          hora_agendamento?: string | null
          id?: string
          is_sandbox?: boolean
          landing_page?: string | null
          local_atendimento?: string
          motivo_status?: string | null
          nome_completo?: string
          observacoes_internas?: string | null
          observacoes_internas_encrypted?: string | null
          origem?: string | null
          profissional_id?: string | null
          referrer?: string | null
          sandbox_reason?: string | null
          servico_id?: string | null
          status_crm?: string
          status_funil?: string | null
          telefone_canonico?: string | null
          telefone_whatsapp?: string
          tipo_atendimento?: string
          ultimo_followup_em?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wbraid?: string | null
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
            foreignKeyName: "bot_assistente_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "vw_crm_kanban"
            referencedColumns: ["agendamento_id"]
          },
          {
            foreignKeyName: "bot_assistente_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "vw_crm_kanban_all"
            referencedColumns: ["agendamento_id"]
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
          bot_global_ativo: boolean
          id: boolean
          pausa_automatica_ativa: boolean
          pausa_automatica_minutos: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bot_global_ativo?: boolean
          id?: boolean
          pausa_automatica_ativa?: boolean
          pausa_automatica_minutos?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bot_global_ativo?: boolean
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
      configuracoes_envio: {
        Row: {
          blackout_dates: string[]
          id: boolean
          intervalo_max_segundos: number
          intervalo_min_segundos: number
          janela_fim: string
          janela_inicio: string
          limite_diario: number
          limite_sessao: number
          motivo_bloqueio: string | null
          status_global: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blackout_dates?: string[]
          id?: boolean
          intervalo_max_segundos?: number
          intervalo_min_segundos?: number
          janela_fim?: string
          janela_inicio?: string
          limite_diario?: number
          limite_sessao?: number
          motivo_bloqueio?: string | null
          status_global?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blackout_dates?: string[]
          id?: boolean
          intervalo_max_segundos?: number
          intervalo_min_segundos?: number
          janela_fim?: string
          janela_inicio?: string
          limite_diario?: number
          limite_sessao?: number
          motivo_bloqueio?: string | null
          status_global?: string
          updated_at?: string
          updated_by?: string | null
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
            foreignKeyName: "conversation_intents_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "vw_crm_kanban"
            referencedColumns: ["agendamento_id"]
          },
          {
            foreignKeyName: "conversation_intents_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "vw_crm_kanban_all"
            referencedColumns: ["agendamento_id"]
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
          {
            foreignKeyName: "crm_audit_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "vw_crm_kanban"
            referencedColumns: ["agendamento_id"]
          },
          {
            foreignKeyName: "crm_audit_log_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "vw_crm_kanban_all"
            referencedColumns: ["agendamento_id"]
          },
        ]
      }
      crm_webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          event: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          event: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          event?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
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
          modelo_id: string | null
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
          modelo_id?: string | null
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
          modelo_id?: string | null
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
          {
            foreignKeyName: "disponibilidade_especifica_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_semanal"
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
          nome: string | null
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
          nome?: string | null
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
          nome?: string | null
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
      integracao_secrets: {
        Row: {
          nome: string
          rotacionado_em: string
          rotacionado_por: string | null
          rotacionado_por_email: string | null
          valor_encrypted: string
          versao: number
        }
        Insert: {
          nome: string
          rotacionado_em?: string
          rotacionado_por?: string | null
          rotacionado_por_email?: string | null
          valor_encrypted: string
          versao?: number
        }
        Update: {
          nome?: string
          rotacionado_em?: string
          rotacionado_por?: string | null
          rotacionado_por_email?: string | null
          valor_encrypted?: string
          versao?: number
        }
        Relationships: []
      }
      integracoes_evolution: {
        Row: {
          api_token_encrypted: string | null
          base_url: string
          id: boolean
          instance: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_token_encrypted?: string | null
          base_url?: string
          id?: boolean
          instance?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_token_encrypted?: string | null
          base_url?: string
          id?: boolean
          instance?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      janelas_atendimento_lembretes: {
        Row: {
          ano_referencia: number
          created_at: string
          data_envio_sugerida: string
          data_fim: string
          data_inicio: string
          id: string
          mes_referencia: number
          numero_janela: number
          observacao: string | null
          updated_at: string
        }
        Insert: {
          ano_referencia: number
          created_at?: string
          data_envio_sugerida: string
          data_fim: string
          data_inicio: string
          id?: string
          mes_referencia: number
          numero_janela: number
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          ano_referencia?: number
          created_at?: string
          data_envio_sugerida?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          mes_referencia?: number
          numero_janela?: number
          observacao?: string | null
          updated_at?: string
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
      lembretes_campanha_pacientes: {
        Row: {
          campanha_id: string
          created_at: string
          data_ultima_consulta: string | null
          id: string
          inconsistente_data: boolean
          lembrete_id: string
          lock_token: string | null
          lock_until: string | null
          motivo_falha: string | null
          motivo_ignorado: string | null
          nome: string
          numero_remessa: number
          primeiro_nome: string | null
          processado_por: string | null
          remessa_id: string
          status: string
          telefone: string
          ultimo_envio_em: string | null
          updated_at: string
        }
        Insert: {
          campanha_id: string
          created_at?: string
          data_ultima_consulta?: string | null
          id?: string
          inconsistente_data?: boolean
          lembrete_id: string
          lock_token?: string | null
          lock_until?: string | null
          motivo_falha?: string | null
          motivo_ignorado?: string | null
          nome: string
          numero_remessa: number
          primeiro_nome?: string | null
          processado_por?: string | null
          remessa_id: string
          status?: string
          telefone: string
          ultimo_envio_em?: string | null
          updated_at?: string
        }
        Update: {
          campanha_id?: string
          created_at?: string
          data_ultima_consulta?: string | null
          id?: string
          inconsistente_data?: boolean
          lembrete_id?: string
          lock_token?: string | null
          lock_until?: string | null
          motivo_falha?: string | null
          motivo_ignorado?: string | null
          nome?: string
          numero_remessa?: number
          primeiro_nome?: string | null
          processado_por?: string | null
          remessa_id?: string
          status?: string
          telefone?: string
          ultimo_envio_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_campanha_pacientes_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "lembretes_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_campanha_pacientes_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "lembretes_campanha_remessas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_campanha_pacientes_remessa_id_fkey"
            columns: ["remessa_id"]
            isOneToOne: false
            referencedRelation: "vw_status_janelas_atual"
            referencedColumns: ["remessa_id"]
          },
        ]
      }
      lembretes_campanha_remessas: {
        Row: {
          campanha_id: string
          created_at: string
          data_programada: string
          enviados: number
          falhas: number
          fim_em: string | null
          id: string
          ignorados: number
          inicio_em: string | null
          janela_atendimento_id: string | null
          motivo_bloqueio: string | null
          numero_remessa: number
          processados: number
          quantidade_planejada: number
          status: string
          updated_at: string
        }
        Insert: {
          campanha_id: string
          created_at?: string
          data_programada: string
          enviados?: number
          falhas?: number
          fim_em?: string | null
          id?: string
          ignorados?: number
          inicio_em?: string | null
          janela_atendimento_id?: string | null
          motivo_bloqueio?: string | null
          numero_remessa: number
          processados?: number
          quantidade_planejada?: number
          status?: string
          updated_at?: string
        }
        Update: {
          campanha_id?: string
          created_at?: string
          data_programada?: string
          enviados?: number
          falhas?: number
          fim_em?: string | null
          id?: string
          ignorados?: number
          inicio_em?: string | null
          janela_atendimento_id?: string | null
          motivo_bloqueio?: string | null
          numero_remessa?: number
          processados?: number
          quantidade_planejada?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_campanha_remessas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "lembretes_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_campanha_remessas_janela_atendimento_id_fkey"
            columns: ["janela_atendimento_id"]
            isOneToOne: false
            referencedRelation: "janelas_atendimento_lembretes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_campanha_remessas_janela_atendimento_id_fkey"
            columns: ["janela_atendimento_id"]
            isOneToOne: false
            referencedRelation: "vw_status_janelas_atual"
            referencedColumns: ["janela_id"]
          },
        ]
      }
      lembretes_campanhas: {
        Row: {
          ano_referencia: number
          concluida_em: string | null
          created_at: string
          created_by: string | null
          gerada_em: string
          id: string
          inconsistencias: number
          mes_referencia: number
          status: string
          total_elegivel: number
          total_enviados: number
          total_falhas: number
          total_ignorados: number
          updated_at: string
        }
        Insert: {
          ano_referencia: number
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          gerada_em?: string
          id?: string
          inconsistencias?: number
          mes_referencia: number
          status?: string
          total_elegivel?: number
          total_enviados?: number
          total_falhas?: number
          total_ignorados?: number
          updated_at?: string
        }
        Update: {
          ano_referencia?: number
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          gerada_em?: string
          id?: string
          inconsistencias?: number
          mes_referencia?: number
          status?: string
          total_elegivel?: number
          total_enviados?: number
          total_falhas?: number
          total_ignorados?: number
          updated_at?: string
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
      logs_envio_lembrete: {
        Row: {
          agente: string
          campanha_id: string | null
          created_at: string
          delay_antes_ms: number | null
          delay_depois_ms: number | null
          id: string
          latencia_ms: number | null
          lembrete_id: string | null
          mensagem_renderizada: string | null
          motivo: string | null
          nome: string | null
          paciente_campanha_id: string | null
          payload: Json | null
          remessa_id: string | null
          request_id: string | null
          status: string
          status_global_no_envio: string | null
          telefone: string | null
          variacao_id: string | null
          variacao_nome: string | null
        }
        Insert: {
          agente: string
          campanha_id?: string | null
          created_at?: string
          delay_antes_ms?: number | null
          delay_depois_ms?: number | null
          id?: string
          latencia_ms?: number | null
          lembrete_id?: string | null
          mensagem_renderizada?: string | null
          motivo?: string | null
          nome?: string | null
          paciente_campanha_id?: string | null
          payload?: Json | null
          remessa_id?: string | null
          request_id?: string | null
          status: string
          status_global_no_envio?: string | null
          telefone?: string | null
          variacao_id?: string | null
          variacao_nome?: string | null
        }
        Update: {
          agente?: string
          campanha_id?: string | null
          created_at?: string
          delay_antes_ms?: number | null
          delay_depois_ms?: number | null
          id?: string
          latencia_ms?: number | null
          lembrete_id?: string | null
          mensagem_renderizada?: string | null
          motivo?: string | null
          nome?: string | null
          paciente_campanha_id?: string | null
          payload?: Json | null
          remessa_id?: string | null
          request_id?: string | null
          status?: string
          status_global_no_envio?: string | null
          telefone?: string | null
          variacao_id?: string | null
          variacao_nome?: string | null
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
          provider: string | null
          provider_message_id: string | null
          status_envio: string | null
          telefone: string
          telefone_canonico: string | null
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
          provider?: string | null
          provider_message_id?: string | null
          status_envio?: string | null
          telefone: string
          telefone_canonico?: string | null
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
          provider?: string | null
          provider_message_id?: string | null
          status_envio?: string | null
          telefone?: string
          telefone_canonico?: string | null
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
          {
            foreignKeyName: "mensagens_whatsapp_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "vw_crm_kanban"
            referencedColumns: ["agendamento_id"]
          },
          {
            foreignKeyName: "mensagens_whatsapp_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "vw_crm_kanban_all"
            referencedColumns: ["agendamento_id"]
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
      site_config: {
        Row: {
          expected_meta_pixel_id: string
          id: boolean
          updated_at: string
          updated_by: string | null
          whatsapp_number: string
        }
        Insert: {
          expected_meta_pixel_id?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string
        }
        Update: {
          expected_meta_pixel_id?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string
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
      templates_whatsapp_variacoes: {
        Row: {
          ativo: boolean
          conteudo: string
          created_at: string
          id: string
          nome: string
          peso: number
          template_tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conteudo: string
          created_at?: string
          id?: string
          nome: string
          peso?: number
          template_tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          id?: string
          nome?: string
          peso?: number
          template_tipo?: string
          updated_at?: string
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
      v_saude_integracoes: {
        Row: {
          gerado_em: string | null
          in_orfas_24h: number | null
          intents_24h: number | null
          mensagens_orfas: number | null
          net_2xx_24h: number | null
          net_4xx_24h: number | null
          net_5xx_24h: number | null
          net_timeouts_24h: number | null
          net_ultimo_erro_at: string | null
          net_ultimo_erro_status: number | null
          out_confirmados_24h: number | null
          pacientes_aguardando_resposta: number | null
          pacientes_ultima_msg_in: number | null
        }
        Relationships: []
      }
      vw_crm_kanban: {
        Row: {
          agendamento_id: string | null
          bot_ativo: boolean | null
          bot_pausado_ate: string | null
          clinica_id: string | null
          clinica_nome: string | null
          coluna_kanban: string | null
          confirmacao_enviada: boolean | null
          confirmation_status: string | null
          convenio: string | null
          convenio_outro: string | null
          created_at: string | null
          data_agendamento: string | null
          data_nascimento: string | null
          detalhe_exame_ou_cirurgia: string | null
          email: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gclid: string | null
          hora_agendamento: string | null
          is_sandbox: boolean | null
          landing_page: string | null
          nome: string | null
          origem: string | null
          profissional_id: string | null
          profissional_nome: string | null
          referrer: string | null
          sandbox_reason: string | null
          servico_id: string | null
          servico_nome: string | null
          status_crm: string | null
          status_funil: string | null
          telefone: string | null
          tipo_atendimento: string | null
          total_mensagens: number | null
          ultima_msg: string | null
          ultima_msg_at: string | null
          ultima_msg_direcao: string | null
          ultima_msg_lida: boolean | null
          unidade: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_convenio: number | null
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
      vw_crm_kanban_all: {
        Row: {
          agendamento_id: string | null
          bot_ativo: boolean | null
          bot_pausado_ate: string | null
          clinica_id: string | null
          clinica_nome: string | null
          coluna_kanban: string | null
          confirmacao_enviada: boolean | null
          confirmation_status: string | null
          convenio: string | null
          convenio_outro: string | null
          created_at: string | null
          data_agendamento: string | null
          data_nascimento: string | null
          detalhe_exame_ou_cirurgia: string | null
          email: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          gclid: string | null
          hora_agendamento: string | null
          is_sandbox: boolean | null
          landing_page: string | null
          nome: string | null
          origem: string | null
          profissional_id: string | null
          profissional_nome: string | null
          referrer: string | null
          sandbox_reason: string | null
          servico_id: string | null
          servico_nome: string | null
          status_crm: string | null
          status_funil: string | null
          telefone: string | null
          tipo_atendimento: string | null
          total_mensagens: number | null
          ultima_msg: string | null
          ultima_msg_at: string | null
          ultima_msg_direcao: string | null
          ultima_msg_lida: boolean | null
          unidade: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_convenio: number | null
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
      vw_status_campanha_atual: {
        Row: {
          ano_referencia: number | null
          blackout_dates: string[] | null
          bloqueados_hoje: number | null
          campanha_id: string | null
          campanha_status: string | null
          data_atual: string | null
          enviados_hoje: number | null
          falhas_hoje: number | null
          gerado_em: string | null
          ignorados_hoje: number | null
          janela_fim: string | null
          janela_inicio: string | null
          limite_diario: number | null
          limite_sessao: number | null
          mes_referencia: number | null
          motivo_bloqueio: string | null
          pacientes_enviados: number | null
          pacientes_falhas: number | null
          pacientes_ignorados: number | null
          pacientes_pendentes: number | null
          proxima_remessa_data: string | null
          proxima_remessa_id: string | null
          proxima_remessa_numero: number | null
          proxima_remessa_status: string | null
          status_global: string | null
          total_elegivel: number | null
          total_enviados: number | null
          total_falhas: number | null
          total_ignorados: number | null
          ultimo_envio_at: string | null
        }
        Relationships: []
      }
      vw_status_janelas_atual: {
        Row: {
          ano_referencia: number | null
          data_envio_sugerida: string | null
          data_fim: string | null
          data_inicio: string | null
          data_programada: string | null
          janela_id: string | null
          mes_referencia: number | null
          numero_janela: number | null
          observacao: string | null
          pacientes_enviados: number | null
          pacientes_falhas: number | null
          pacientes_ignorados: number | null
          pacientes_pendentes: number | null
          remessa_id: string | null
          remessa_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cron_headers: { Args: never; Returns: Json }
      apagar_dados_paciente: {
        Args: { p_confirmar?: boolean; p_telefone: string }
        Returns: Json
      }
      aplicar_retencao_lgpd: { Args: never; Returns: Json }
      atualizar_evolution_config: {
        Args: { p_api_token?: string; p_base_url?: string; p_instance?: string }
        Returns: Json
      }
      auto_compareceu_vencidos: { Args: never; Returns: number }
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
      claim_paciente_campanha: {
        Args: {
          p_paciente_id: string
          p_processador: string
          p_ttl_seconds?: number
        }
        Returns: string
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
      crm_disparar_lembretes_d1: { Args: never; Returns: number }
      crm_emit_event: {
        Args: { p_body: Json; p_event: string }
        Returns: number
      }
      crm_ingest_lead: { Args: { payload: Json }; Returns: Json }
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
      get_available_days: {
        Args: { p_clinica_id: string; p_month: number; p_year: number }
        Returns: {
          data: string
          slots_livres: number
          total_slots: number
        }[]
      }
      get_available_slots: {
        Args: { p_clinica_id: string; p_data: string }
        Returns: {
          hora: string
          status: string
        }[]
      }
      get_leads_sem_boas_vindas: {
        Args: { p_cutoff_minutes?: number }
        Returns: {
          convenio: string
          created_at: string
          id: string
          local_atendimento: string
          nome_completo: string
          telefone_whatsapp: string
          tipo_atendimento: string
        }[]
      }
      get_next_available_slot: {
        Args: { p_clinica_id: string; p_from?: string }
        Returns: {
          data: string
          hora: string
        }[]
      }
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
      info_secret_integracao: {
        Args: { p_nome: string }
        Returns: {
          existe: boolean
          nome: string
          rotacionado_em: string
          rotacionado_por_email: string
          versao: number
        }[]
      }
      ler_secret_integracao: { Args: { p_nome: string }; Returns: string }
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
      mask_email: { Args: { p_email: string }; Returns: string }
      mask_nome: { Args: { p_nome: string }; Returns: string }
      mask_telefone: { Args: { p_tel: string }; Returns: string }
      normalizar_telefone: { Args: { p_telefone: string }; Returns: string }
      obter_evolution_config_interna: { Args: never; Returns: Json }
      obter_evolution_config_mascarada: { Args: never; Returns: Json }
      pausar_bot_agendamento: {
        Args: {
          p_agendamento_id: string
          p_minutos?: number
          p_motivo?: string
        }
        Returns: string
      }
      pode_enviar_outbound: {
        Args: {
          p_janela_minutos: number
          p_max_msgs: number
          p_telefone: string
          p_tipo: string
        }
        Returns: boolean
      }
      preview_dados_paciente: { Args: { p_telefone: string }; Returns: Json }
      purge_old_system_logs: { Args: never; Returns: number }
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
          leads_novos: number
          msg_in: number
          msg_out: number
        }[]
      }
      release_paciente_campanha: {
        Args: { p_lock_token: string; p_paciente_id: string }
        Returns: boolean
      }
      rotacionar_secret_integracao: { Args: { p_nome: string }; Returns: Json }
      saude_integracoes: {
        Args: never
        Returns: {
          gerado_em: string
          in_orfas_24h: number
          intents_24h: number
          mensagens_orfas: number
          net_2xx_24h: number
          net_4xx_24h: number
          net_5xx_24h: number
          net_timeouts_24h: number
          net_ultimo_erro_at: string
          net_ultimo_erro_status: number
          out_confirmados_24h: number
          pacientes_aguardando_resposta: number
          pacientes_ultima_msg_in: number
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
      telefone_canonico: { Args: { p_tel: string }; Returns: string }
      transicionar_estado_agendamento: {
        Args: { p_id: string; p_motivo?: string; p_novo_status_crm: string }
        Returns: Json
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
      vincular_mensagem_por_telefone: {
        Args: { p_mensagem_id: string; p_nome_contato?: string }
        Returns: Json
      }
      vincular_mensagens_orfas: { Args: { p_dry_run?: boolean }; Returns: Json }
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
