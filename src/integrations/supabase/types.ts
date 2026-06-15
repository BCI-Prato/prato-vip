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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      client_credits: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consumption_history: {
        Row: {
          consumed_at: string
          created_at: string
          delivery_id: string | null
          description: string | null
          id: string
          meals_count: number
          user_id: string
        }
        Insert: {
          consumed_at?: string
          created_at?: string
          delivery_id?: string | null
          description?: string | null
          id?: string
          meals_count: number
          user_id: string
        }
        Update: {
          consumed_at?: string
          created_at?: string
          delivery_id?: string | null
          description?: string | null
          id?: string
          meals_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "scheduled_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          created_at: string
          delta: number
          expires_at: string | null
          id: string
          kind: string
          note: string | null
          package_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          expires_at?: string | null
          id?: string
          kind: string
          note?: string | null
          package_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          expires_at?: string | null
          id?: string
          kind?: string
          note?: string | null
          package_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_employees: {
        Row: {
          company_id: string
          created_at: string
          delivery_date: string
          employee_id: string
          id: string
          scheduled_delivery_id: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delivery_date: string
          employee_id: string
          id?: string
          scheduled_delivery_id: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_date?: string
          employee_id?: string
          id?: string
          scheduled_delivery_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_employees_scheduled_delivery_id_fkey"
            columns: ["scheduled_delivery_id"]
            isOneToOne: false
            referencedRelation: "scheduled_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          company_id: string
          created_at: string
          department: string | null
          id: string
          identifier: string
          is_active: boolean
          is_admin: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          department?: string | null
          id?: string
          identifier: string
          is_active?: boolean
          is_admin?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          department?: string | null
          id?: string
          identifier?: string
          is_active?: boolean
          is_admin?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          accepted_terms_at: string
          company_name: string
          created_at: string
          email: string
          full_name: string
          id: string
          message: string | null
          package_id: string | null
          phone: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_terms_at: string
          company_name: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          message?: string | null
          package_id?: string | null
          phone: string
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_terms_at?: string
          company_name?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          message?: string | null
          package_id?: string | null
          phone?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          content: string
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      menus: {
        Row: {
          base: string
          created_at: string
          dessert: string
          id: string
          menu_date: string
          proteins: string[]
          salads: string[]
          sides: string[]
          updated_at: string
        }
        Insert: {
          base?: string
          created_at?: string
          dessert?: string
          id?: string
          menu_date: string
          proteins?: string[]
          salads?: string[]
          sides?: string[]
          updated_at?: string
        }
        Update: {
          base?: string
          created_at?: string
          dessert?: string
          id?: string
          menu_date?: string
          proteins?: string[]
          salads?: string[]
          sides?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          approved_by: string | null
          created_at: string
          credits_amount: number
          id: string
          package_id: string
          package_name: string
          paid_at: string | null
          status: string
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          credits_amount: number
          id?: string
          package_id: string
          package_name: string
          paid_at?: string | null
          status?: string
          total_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          credits_amount?: number
          id?: string
          package_id?: string
          package_name?: string
          paid_at?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          advantage_description: string
          bonuses: string[]
          created_at: string
          credits_amount: number
          display_order: number
          features: string[]
          highlight_tag: string | null
          id: string
          is_active: boolean
          name: string
          price_per_meal_text: string
          total_price: number
          updated_at: string
        }
        Insert: {
          advantage_description: string
          bonuses?: string[]
          created_at?: string
          credits_amount: number
          display_order?: number
          features?: string[]
          highlight_tag?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_per_meal_text: string
          total_price: number
          updated_at?: string
        }
        Update: {
          advantage_description?: string
          bonuses?: string[]
          created_at?: string
          credits_amount?: number
          display_order?: number
          features?: string[]
          highlight_tag?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_per_meal_text?: string
          total_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_cep: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_street: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          delivery_time: string | null
          email: string | null
          finance_email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address_cep?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          delivery_time?: string | null
          email?: string | null
          finance_email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address_cep?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_street?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          delivery_time?: string | null
          email?: string | null
          finance_email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_deliveries: {
        Row: {
          created_at: string
          id: string
          meals_count: number
          notes: string | null
          scheduled_for: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meals_count: number
          notes?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meals_count?: number
          notes?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          messages: Json
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          messages?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          messages?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      cnpj_exists: { Args: { _cnpj: string }; Returns: boolean }
      confirm_scheduled_deliveries: { Args: { _items: Json }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
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
      app_role: ["admin", "client"],
    },
  },
} as const
