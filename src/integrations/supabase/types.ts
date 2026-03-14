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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_type: string
          created_at: string
          description: string | null
          id: string
          name: string
          ticker: string | null
          user_id: string
        }
        Insert: {
          asset_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          ticker?: string | null
          user_id: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          ticker?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefs: {
        Row: {
          content: string
          created_at: string
          id: string
          tickers: string[] | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          tickers?: string[] | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tickers?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          asset_id: string | null
          created_at: string
          doc_type: string | null
          extracted_text: string | null
          file_path: string
          file_size: number | null
          id: string
          name: string
          status: string
          ticker: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          doc_type?: string | null
          extracted_text?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          name: string
          status?: string
          ticker?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          doc_type?: string | null
          extracted_text?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          name?: string
          status?: string
          ticker?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      groq_usage: {
        Row: {
          created_at: string
          date: string
          id: string
          request_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          request_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          request_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      health_scores: {
        Row: {
          asset_id: string | null
          confidence: number | null
          created_at: string
          debt_level: number
          document_id: string | null
          earnings_quality: number
          id: string
          net_margin: number
          overall_score: number
          price_target_high: number | null
          price_target_low: number | null
          price_target_rationale: string | null
          red_flags: Json | null
          regulatory_risk: number
          revenue_growth: number
          sentiment: string | null
          summary: string | null
          ticker: string | null
          timeline_events: Json | null
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          confidence?: number | null
          created_at?: string
          debt_level?: number
          document_id?: string | null
          earnings_quality?: number
          id?: string
          net_margin?: number
          overall_score?: number
          price_target_high?: number | null
          price_target_low?: number | null
          price_target_rationale?: string | null
          red_flags?: Json | null
          regulatory_risk?: number
          revenue_growth?: number
          sentiment?: string | null
          summary?: string | null
          ticker?: string | null
          timeline_events?: Json | null
          user_id: string
        }
        Update: {
          asset_id?: string | null
          confidence?: number | null
          created_at?: string
          debt_level?: number
          document_id?: string | null
          earnings_quality?: number
          id?: string
          net_margin?: number
          overall_score?: number
          price_target_high?: number | null
          price_target_low?: number | null
          price_target_rationale?: string | null
          red_flags?: Json | null
          regulatory_risk?: number
          revenue_growth?: number
          sentiment?: string | null
          summary?: string | null
          ticker?: string | null
          timeline_events?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_scores_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_scores_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          custom_prompt: string | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          custom_prompt?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          custom_prompt?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_brief_assets: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          scheduled_brief_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          scheduled_brief_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          scheduled_brief_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_brief_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_brief_assets_scheduled_brief_id_fkey"
            columns: ["scheduled_brief_id"]
            isOneToOne: false
            referencedRelation: "scheduled_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_briefs: {
        Row: {
          created_at: string
          id: string
          include_macro: boolean
          include_news: boolean
          is_active: boolean
          last_run_at: string | null
          notify_email: boolean
          schedule_time: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          include_macro?: boolean
          include_news?: boolean
          is_active?: boolean
          last_run_at?: string | null
          notify_email?: boolean
          schedule_time?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          include_macro?: boolean
          include_news?: boolean
          is_active?: boolean
          last_run_at?: string | null
          notify_email?: boolean
          schedule_time?: string
          user_id?: string
        }
        Relationships: []
      }
      sentiment_analyses: {
        Row: {
          confidence: number | null
          created_at: string
          document_id: string | null
          id: string
          sentiment: string
          summary: string | null
          ticker: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          document_id?: string | null
          id?: string
          sentiment: string
          summary?: string | null
          ticker?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          document_id?: string | null
          id?: string
          sentiment?: string
          summary?: string | null
          ticker?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          ticker: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ticker: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
