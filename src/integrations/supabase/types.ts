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
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      budget_outcomes: {
        Row: {
          akt: string | null
          ansvar: string | null
          budget_2025: number | null
          budget_2026: number | null
          diff: number | null
          extraction_date: string | null
          id: string
          import_date: string
          import_label: string | null
          imported_at: string
          imported_by: string | null
          kgrp: string | null
          mot: string | null
          objekt: string | null
          proj: string | null
          ukonto: string | null
          utfall_ack: number | null
          vht: string | null
        }
        Insert: {
          akt?: string | null
          ansvar?: string | null
          budget_2025?: number | null
          budget_2026?: number | null
          diff?: number | null
          extraction_date?: string | null
          id?: string
          import_date?: string
          import_label?: string | null
          imported_at?: string
          imported_by?: string | null
          kgrp?: string | null
          mot?: string | null
          objekt?: string | null
          proj?: string | null
          ukonto?: string | null
          utfall_ack?: number | null
          vht?: string | null
        }
        Update: {
          akt?: string | null
          ansvar?: string | null
          budget_2025?: number | null
          budget_2026?: number | null
          diff?: number | null
          extraction_date?: string | null
          id?: string
          import_date?: string
          import_label?: string | null
          imported_at?: string
          imported_by?: string | null
          kgrp?: string | null
          mot?: string | null
          objekt?: string | null
          proj?: string | null
          ukonto?: string | null
          utfall_ack?: number | null
          vht?: string | null
        }
        Relationships: []
      }
      calculation_items: {
        Row: {
          calculation_id: string
          comment: string | null
          created_at: string
          id: string
          price_type: string
          pricing_config_id: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          calculation_id: string
          comment?: string | null
          created_at?: string
          id?: string
          price_type: string
          pricing_config_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          calculation_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          price_type?: string
          pricing_config_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculation_items_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_items_pricing_config_id_fkey"
            columns: ["pricing_config_id"]
            isOneToOne: false
            referencedRelation: "pricing_config"
            referencedColumns: ["id"]
          },
        ]
      }
      calculation_versions: {
        Row: {
          calculation_id: string
          calculation_year: number
          ci_identity: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          customer_id: string | null
          id: string
          items: Json
          municipality: string
          name: string | null
          organization_id: string | null
          owning_organization: string | null
          owning_organization_id: string | null
          service_type: string
          status: Database["public"]["Enums"]["calculation_status"]
          total_cost: number
          version: number
        }
        Insert: {
          calculation_id: string
          calculation_year: number
          ci_identity: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_id?: string | null
          id?: string
          items?: Json
          municipality: string
          name?: string | null
          organization_id?: string | null
          owning_organization?: string | null
          owning_organization_id?: string | null
          service_type: string
          status: Database["public"]["Enums"]["calculation_status"]
          total_cost?: number
          version: number
        }
        Update: {
          calculation_id?: string
          calculation_year?: number
          ci_identity?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          customer_id?: string | null
          id?: string
          items?: Json
          municipality?: string
          name?: string | null
          organization_id?: string | null
          owning_organization?: string | null
          owning_organization_id?: string | null
          service_type?: string
          status?: Database["public"]["Enums"]["calculation_status"]
          total_cost?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculation_versions_calculation_id_fkey"
            columns: ["calculation_id"]
            isOneToOne: false
            referencedRelation: "calculations"
            referencedColumns: ["id"]
          },
        ]
      }
      calculations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          calculation_year: number
          ci_identity: string
          cpu_cost: number
          cpu_count: number
          created_at: string
          created_by_name: string | null
          customer_id: string | null
          id: string
          municipality: string
          name: string | null
          operation_cost: number
          operation_hours: number
          organization_id: string | null
          owning_organization: string | null
          owning_organization_id: string | null
          server_cost: number
          server_count: number
          service_type: string
          status: Database["public"]["Enums"]["calculation_status"]
          storage_cost: number
          storage_gb: number
          total_cost: number
          updated_at: string | null
          updated_by_name: string | null
          user_id: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          calculation_year?: number
          ci_identity: string
          cpu_cost?: number
          cpu_count?: number
          created_at?: string
          created_by_name?: string | null
          customer_id?: string | null
          id?: string
          municipality?: string
          name?: string | null
          operation_cost?: number
          operation_hours?: number
          organization_id?: string | null
          owning_organization?: string | null
          owning_organization_id?: string | null
          server_cost?: number
          server_count?: number
          service_type?: string
          status?: Database["public"]["Enums"]["calculation_status"]
          storage_cost?: number
          storage_gb?: number
          total_cost?: number
          updated_at?: string | null
          updated_by_name?: string | null
          user_id: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          calculation_year?: number
          ci_identity?: string
          cpu_cost?: number
          cpu_count?: number
          created_at?: string
          created_by_name?: string | null
          customer_id?: string | null
          id?: string
          municipality?: string
          name?: string | null
          operation_cost?: number
          operation_hours?: number
          organization_id?: string | null
          owning_organization?: string | null
          owning_organization_id?: string | null
          server_cost?: number
          server_count?: number
          service_type?: string
          status?: Database["public"]["Enums"]["calculation_status"]
          storage_cost?: number
          storage_gb?: number
          total_cost?: number
          updated_at?: string | null
          updated_by_name?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calculations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculations_owning_organization_id_fkey"
            columns: ["owning_organization_id"]
            isOneToOne: false
            referencedRelation: "owning_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      configuration_items: {
        Row: {
          ci_number: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          object_number: string | null
          organization: string | null
          system_administrator: string | null
          system_name: string
          system_owner: string | null
          updated_at: string
        }
        Insert: {
          ci_number: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          object_number?: string | null
          organization?: string | null
          system_administrator?: string | null
          system_name: string
          system_owner?: string | null
          updated_at?: string
        }
        Update: {
          ci_number?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          object_number?: string | null
          organization?: string | null
          system_administrator?: string | null
          system_name?: string
          system_owner?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      news: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      owning_organizations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          category: string | null
          comment: string | null
          cost_owner: string | null
          created_at: string
          created_by: string | null
          disallowed_service_types: string[] | null
          effective_from: string
          effective_to: string | null
          external_account: string | null
          id: string
          internal_account: string | null
          price_per_unit: number
          price_type: string
          service_types: string[] | null
          ukonto: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          comment?: string | null
          cost_owner?: string | null
          created_at?: string
          created_by?: string | null
          disallowed_service_types?: string[] | null
          effective_from: string
          effective_to?: string | null
          external_account?: string | null
          id?: string
          internal_account?: string | null
          price_per_unit: number
          price_type: string
          service_types?: string[] | null
          ukonto?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          comment?: string | null
          cost_owner?: string | null
          created_at?: string
          created_by?: string | null
          disallowed_service_types?: string[] | null
          effective_from?: string
          effective_to?: string | null
          external_account?: string | null
          id?: string
          internal_account?: string | null
          price_per_unit?: number
          price_type?: string
          service_types?: string[] | null
          ukonto?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approval_organizations: string[] | null
          can_approve: boolean
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          permission_level: Database["public"]["Enums"]["permission_level"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_organizations?: string[] | null
          can_approve?: boolean
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          permission_level?: Database["public"]["Enums"]["permission_level"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_organizations?: string[] | null
          can_approve?: boolean
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          permission_level?: Database["public"]["Enums"]["permission_level"]
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
          role?: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_write_permission: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "superadmin"
      calculation_status: "draft" | "pending_approval" | "approved" | "closed"
      permission_level: "read_only" | "read_write"
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
      app_role: ["admin", "user", "superadmin"],
      calculation_status: ["draft", "pending_approval", "approved", "closed"],
      permission_level: ["read_only", "read_write"],
    },
  },
} as const
