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
      collection_history: {
        Row: {
          collection_type: string
          completed_at: string | null
          created_at: string | null
          device_id: string
          error_message: string | null
          id: string
          parsed_data: Json | null
          raw_output: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["collection_status"] | null
        }
        Insert: {
          collection_type: string
          completed_at?: string | null
          created_at?: string | null
          device_id: string
          error_message?: string | null
          id?: string
          parsed_data?: Json | null
          raw_output?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["collection_status"] | null
        }
        Update: {
          collection_type?: string
          completed_at?: string | null
          created_at?: string | null
          device_id?: string
          error_message?: string | null
          id?: string
          parsed_data?: Json | null
          raw_output?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["collection_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_history_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "network_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      device_interfaces: {
        Row: {
          admin_status: string | null
          created_at: string | null
          description: string | null
          device_id: string
          id: string
          ip_addresses: unknown[] | null
          mac_address: string | null
          metadata: Json | null
          name: string
          oper_status: string | null
          speed_mbps: number | null
          updated_at: string | null
          vlan_id: number | null
        }
        Insert: {
          admin_status?: string | null
          created_at?: string | null
          description?: string | null
          device_id: string
          id?: string
          ip_addresses?: unknown[] | null
          mac_address?: string | null
          metadata?: Json | null
          name: string
          oper_status?: string | null
          speed_mbps?: number | null
          updated_at?: string | null
          vlan_id?: number | null
        }
        Update: {
          admin_status?: string | null
          created_at?: string | null
          description?: string | null
          device_id?: string
          id?: string
          ip_addresses?: unknown[] | null
          mac_address?: string | null
          metadata?: Json | null
          name?: string
          oper_status?: string | null
          speed_mbps?: number | null
          updated_at?: string | null
          vlan_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "device_interfaces_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "network_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      network_devices: {
        Row: {
          created_at: string | null
          description: string | null
          hostname: string
          id: string
          ip_address: unknown
          last_seen: string | null
          location: string | null
          management_ip: unknown
          metadata: Json | null
          model: string | null
          name: string
          os_version: string | null
          serial_number: string | null
          ssh_password_encrypted: string | null
          ssh_port: number | null
          ssh_username: string | null
          status: Database["public"]["Enums"]["device_status"] | null
          updated_at: string | null
          vendor: Database["public"]["Enums"]["vendor_type"]
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hostname: string
          id?: string
          ip_address: unknown
          last_seen?: string | null
          location?: string | null
          management_ip?: unknown
          metadata?: Json | null
          model?: string | null
          name: string
          os_version?: string | null
          serial_number?: string | null
          ssh_password_encrypted?: string | null
          ssh_port?: number | null
          ssh_username?: string | null
          status?: Database["public"]["Enums"]["device_status"] | null
          updated_at?: string | null
          vendor?: Database["public"]["Enums"]["vendor_type"]
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hostname?: string
          id?: string
          ip_address?: unknown
          last_seen?: string | null
          location?: string | null
          management_ip?: unknown
          metadata?: Json | null
          model?: string | null
          name?: string
          os_version?: string | null
          serial_number?: string | null
          ssh_password_encrypted?: string | null
          ssh_port?: number | null
          ssh_username?: string | null
          status?: Database["public"]["Enums"]["device_status"] | null
          updated_at?: string | null
          vendor?: Database["public"]["Enums"]["vendor_type"]
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      topology_links: {
        Row: {
          bandwidth_mbps: number | null
          created_at: string | null
          id: string
          link_type: string | null
          metadata: Json | null
          source_device_id: string
          source_interface: string | null
          status: string | null
          target_device_id: string
          target_interface: string | null
          updated_at: string | null
        }
        Insert: {
          bandwidth_mbps?: number | null
          created_at?: string | null
          id?: string
          link_type?: string | null
          metadata?: Json | null
          source_device_id: string
          source_interface?: string | null
          status?: string | null
          target_device_id: string
          target_interface?: string | null
          updated_at?: string | null
        }
        Update: {
          bandwidth_mbps?: number | null
          created_at?: string | null
          id?: string
          link_type?: string | null
          metadata?: Json | null
          source_device_id?: string
          source_interface?: string | null
          status?: string | null
          target_device_id?: string
          target_interface?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topology_links_source_device_id_fkey"
            columns: ["source_device_id"]
            isOneToOne: false
            referencedRelation: "network_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topology_links_target_device_id_fkey"
            columns: ["target_device_id"]
            isOneToOne: false
            referencedRelation: "network_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      topology_neighbors: {
        Row: {
          discovered_at: string | null
          discovery_protocol: Database["public"]["Enums"]["discovery_protocol"]
          id: string
          last_updated: string | null
          local_device_id: string
          local_interface: string
          raw_data: Json | null
          remote_device_id: string | null
          remote_device_name: string | null
          remote_interface: string | null
          remote_ip: unknown
        }
        Insert: {
          discovered_at?: string | null
          discovery_protocol: Database["public"]["Enums"]["discovery_protocol"]
          id?: string
          last_updated?: string | null
          local_device_id: string
          local_interface: string
          raw_data?: Json | null
          remote_device_id?: string | null
          remote_device_name?: string | null
          remote_interface?: string | null
          remote_ip?: unknown
        }
        Update: {
          discovered_at?: string | null
          discovery_protocol?: Database["public"]["Enums"]["discovery_protocol"]
          id?: string
          last_updated?: string | null
          local_device_id?: string
          local_interface?: string
          raw_data?: Json | null
          remote_device_id?: string | null
          remote_device_name?: string | null
          remote_interface?: string | null
          remote_ip?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "topology_neighbors_local_device_id_fkey"
            columns: ["local_device_id"]
            isOneToOne: false
            referencedRelation: "network_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topology_neighbors_remote_device_id_fkey"
            columns: ["remote_device_id"]
            isOneToOne: false
            referencedRelation: "network_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      topology_snapshots: {
        Row: {
          created_at: string | null
          description: string | null
          drawio_xml: string | null
          id: string
          name: string
          topology_data: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          drawio_xml?: string | null
          id?: string
          name: string
          topology_data: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          drawio_xml?: string | null
          id?: string
          name?: string
          topology_data?: Json
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
      collection_status: "pending" | "running" | "completed" | "failed"
      device_status: "online" | "offline" | "unknown" | "error"
      discovery_protocol: "lldp" | "ospf" | "cdp" | "manual"
      vendor_type:
        | "huawei"
        | "juniper"
        | "mikrotik"
        | "datacom"
        | "cisco"
        | "other"
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
      collection_status: ["pending", "running", "completed", "failed"],
      device_status: ["online", "offline", "unknown", "error"],
      discovery_protocol: ["lldp", "ospf", "cdp", "manual"],
      vendor_type: [
        "huawei",
        "juniper",
        "mikrotik",
        "datacom",
        "cisco",
        "other",
      ],
    },
  },
} as const
