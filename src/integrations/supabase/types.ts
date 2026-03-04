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
          google_calendar_event_id: string | null
          hora_agendamento: string | null
          id: string
          local_atendimento: string
          nome_completo: string
          observacoes_internas: string | null
          observacoes_internas_encrypted: string | null
          origem: string | null
          profissional_id: string | null
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
          google_calendar_event_id?: string | null
          hora_agendamento?: string | null
          id?: string
          local_atendimento: string
          nome_completo: string
          observacoes_internas?: string | null
          observacoes_internas_encrypted?: string | null
          origem?: string | null
          profissional_id?: string | null
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
          google_calendar_event_id?: string | null
          hora_agendamento?: string | null
          id?: string
          local_atendimento?: string
          nome_completo?: string
          observacoes_internas?: string | null
          observacoes_internas_encrypted?: string | null
          origem?: string | null
          profissional_id?: string | null
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
      google_calendar_tokens: {
        Row: {
          access_token: string
          calendar_id: string | null
          created_at: string | null
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          refresh_token?: string
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
      decrypt_sensitive_data: {
        Args: { encrypted_data: string }
        Returns: string
      }
      decrypt_totp_secret: {
        Args: { encrypted_secret: string }
        Returns: string
      }
      encrypt_sensitive_data: { Args: { plain_text: string }; Returns: string }
      encrypt_totp_secret: { Args: { plain_secret: string }; Returns: string }
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
      setup_totp: {
        Args: { p_backup_codes: string; p_secret: string; p_user_id: string }
        Returns: undefined
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
