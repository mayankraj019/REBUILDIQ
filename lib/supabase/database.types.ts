export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      analysis_jobs: {
        Row: {
          completed_at: string | null;
          crawl_depth: number;
          created_at: string;
          duration_ms: number | null;
          error_code: string | null;
          error_message: string | null;
          id: string;
          normalized_domain: string;
          progress_percent: number;
          started_at: string | null;
          status: string;
          target_url: string;
          updated_at: string;
          user_id: string;
          viewports_config: Json;
        };
        Insert: {
          completed_at?: string | null;
          crawl_depth?: number;
          created_at?: string;
          duration_ms?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          normalized_domain: string;
          progress_percent?: number;
          started_at?: string | null;
          status?: string;
          target_url: string;
          updated_at?: string;
          user_id: string;
          viewports_config?: Json;
        };
        Update: {
          completed_at?: string | null;
          crawl_depth?: number;
          created_at?: string;
          duration_ms?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          id?: string;
          normalized_domain?: string;
          progress_percent?: number;
          started_at?: string | null;
          status?: string;
          target_url?: string;
          updated_at?: string;
          user_id?: string;
          viewports_config?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'analysis_jobs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      blueprint_artifacts: {
        Row: {
          antigravity_prompts: string;
          component_architecture: Json;
          design_system_spec: Json;
          generated_at: string;
          id: string;
          is_edited_by_user: boolean;
          job_id: string;
          recommended_stack: Json;
          state_interactions: Json;
          updated_at: string;
          version: string;
        };
        Insert: {
          antigravity_prompts?: string;
          component_architecture?: Json;
          design_system_spec?: Json;
          generated_at?: string;
          id?: string;
          is_edited_by_user?: boolean;
          job_id: string;
          recommended_stack?: Json;
          state_interactions?: Json;
          updated_at?: string;
          version?: string;
        };
        Update: {
          antigravity_prompts?: string;
          component_architecture?: Json;
          design_system_spec?: Json;
          generated_at?: string;
          id?: string;
          is_edited_by_user?: boolean;
          job_id?: string;
          recommended_stack?: Json;
          state_interactions?: Json;
          updated_at?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blueprint_artifacts_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'analysis_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      job_audit_logs: {
        Row: {
          id: string;
          job_id: string;
          level: string;
          message: string;
          metadata: Json | null;
          stage: string;
          timestamp: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          level: string;
          message: string;
          metadata?: Json | null;
          stage: string;
          timestamp?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          level?: string;
          message?: string;
          metadata?: Json | null;
          stage?: string;
          timestamp?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'job_audit_logs_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'analysis_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      page_evidence: {
        Row: {
          computed_colors: Json;
          computed_spacing: Json;
          computed_typography: Json;
          detected_components: Json;
          dom_node_count: number;
          dom_structure: Json;
          extracted_at: string;
          id: string;
          job_id: string;
          meta_tags: Json;
          page_title: string;
          page_url: string;
        };
        Insert: {
          computed_colors?: Json;
          computed_spacing?: Json;
          computed_typography?: Json;
          detected_components?: Json;
          dom_node_count?: number;
          dom_structure?: Json;
          extracted_at?: string;
          id?: string;
          job_id: string;
          meta_tags?: Json;
          page_title: string;
          page_url: string;
        };
        Update: {
          computed_colors?: Json;
          computed_spacing?: Json;
          computed_typography?: Json;
          detected_components?: Json;
          dom_node_count?: number;
          dom_structure?: Json;
          extracted_at?: string;
          id?: string;
          job_id?: string;
          meta_tags?: Json;
          page_title?: string;
          page_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'page_evidence_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'analysis_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      user_sessions: {
        Row: {
          auth_method: string;
          auth_session_id: string | null;
          expires_at: string | null;
          id: string;
          ip_address: string | null;
          last_active_at: string;
          logged_in_at: string;
          revoked_at: string | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth_method?: string;
          auth_session_id?: string | null;
          expires_at?: string | null;
          id?: string;
          ip_address?: string | null;
          last_active_at?: string;
          logged_in_at?: string;
          revoked_at?: string | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth_method?: string;
          auth_session_id?: string | null;
          expires_at?: string | null;
          id?: string;
          ip_address?: string | null;
          last_active_at?: string;
          logged_in_at?: string;
          revoked_at?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          default_prompt_target: string;
          deleted_at: string | null;
          deletion_reason: string | null;
          deletion_scheduled_at: string | null;
          email: string;
          id: string;
          name: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_prompt_target?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
          deletion_scheduled_at?: string | null;
          email: string;
          id: string;
          name: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_prompt_target?: string;
          deleted_at?: string | null;
          deletion_reason?: string | null;
          deletion_scheduled_at?: string | null;
          email?: string;
          id?: string;
          name?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      visual_screenshots: {
        Row: {
          captured_at: string;
          evidence_id: string;
          file_hash: string;
          file_size_bytes: number;
          height: number;
          id: string;
          mime_type: string;
          storage_key: string;
          viewport_type: string;
          width: number;
        };
        Insert: {
          captured_at?: string;
          evidence_id: string;
          file_hash: string;
          file_size_bytes: number;
          height: number;
          id?: string;
          mime_type?: string;
          storage_key: string;
          viewport_type: string;
          width: number;
        };
        Update: {
          captured_at?: string;
          evidence_id?: string;
          file_hash?: string;
          file_size_bytes?: number;
          height?: number;
          id?: string;
          mime_type?: string;
          storage_key?: string;
          viewport_type?: string;
          width?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'visual_screenshots_evidence_id_fkey';
            columns: ['evidence_id'];
            isOneToOne: false;
            referencedRelation: 'page_evidence';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
