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
          convenio: string
          convenio_outro: string | null
          created_at: string | null
          data_agendamento: string
          data_nascimento: string | null
          detalhe_exame_ou_cirurgia: string | null
          email: string | null
          hora_agendamento: string
          id: string
          local_atendimento: string
          nome_completo: string
          observacoes_internas: string | null
          origem: string | null
          profissional_id: string | null
          servico_id: string | null
          status_crm: string
          telefone_whatsapp: string
          tipo_atendimento: string
          updated_at: string | null
        }
        Insert: {
          aceita_contato_whatsapp_email?: boolean | null
          aceita_primeiro_horario?: boolean | null
          clinica_id?: string | null
          confirmacao_enviada?: boolean | null
          convenio: string
          convenio_outro?: string | null
          created_at?: string | null
          data_agendamento: string
          data_nascimento?: string | null
          detalhe_exame_ou_cirurgia?: string | null
          email?: string | null
          hora_agendamento: string
          id?: string
          local_atendimento: string
          nome_completo: string
          observacoes_internas?: string | null
          origem?: string | null
          profissional_id?: string | null
          servico_id?: string | null
          status_crm?: string
          telefone_whatsapp: string
          tipo_atendimento: string
          updated_at?: string | null
        }
        Update: {
          aceita_contato_whatsapp_email?: boolean | null
          aceita_primeiro_horario?: boolean | null
          clinica_id?: string | null
          confirmacao_enviada?: boolean | null
          convenio?: string
          convenio_outro?: string | null
          created_at?: string | null
          data_agendamento?: string
          data_nascimento?: string | null
          detalhe_exame_ou_cirurgia?: string | null
          email?: string | null
          hora_agendamento?: string
          id?: string
          local_atendimento?: string
          nome_completo?: string
          observacoes_internas?: string | null
          origem?: string | null
          profissional_id?: string | null
          servico_id?: string | null
          status_crm?: string
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
      mensagens_whatsapp: {
        Row: {
          agendamento_id: string | null
          conteudo: string
          created_at: string
          direcao: string
          id: string
          lida: boolean | null
          mensagem_externa_id: string | null
          status_envio: string | null
          telefone: string
          tipo_mensagem: string | null
        }
        Insert: {
          agendamento_id?: string | null
          conteudo: string
          created_at?: string
          direcao: string
          id?: string
          lida?: boolean | null
          mensagem_externa_id?: string | null
          status_envio?: string | null
          telefone: string
          tipo_mensagem?: string | null
        }
        Update: {
          agendamento_id?: string | null
          conteudo?: string
          created_at?: string
          direcao?: string
          id?: string
          lida?: boolean | null
          mensagem_externa_id?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      status_crm_enum: "NOVO LEAD" | "CLINICOR" | "HGP" | "BELÉM"
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
      tipo_atendimento_enum: ["Consulta", "Retorno", "Exame", "Cirurgia"],
    },
  },
} as const
