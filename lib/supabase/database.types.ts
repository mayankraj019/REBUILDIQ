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
          attempt_count: number;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          crawl_depth: number;
          created_at: string;
          duration_ms: number | null;
          error_code: string | null;
          error_message: string | null;
          expires_at: string | null;
          heartbeat_at: string | null;
          id: string;
          idempotency_key: string | null;
          lease_expires_at: string | null;
          max_attempts: number;
          normalized_domain: string;
          progress_percent: number;
          started_at: string | null;
          status: string;
          target_url: string;
          updated_at: string;
          user_id: string;
          viewports_config: Json;
          worker_id: string | null;
        };
        Insert: {
          attempt_count?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          crawl_depth?: number;
          created_at?: string;
          duration_ms?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          expires_at?: string | null;
          heartbeat_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          lease_expires_at?: string | null;
          max_attempts?: number;
          normalized_domain: string;
          progress_percent?: number;
          started_at?: string | null;
          status?: string;
          target_url: string;
          updated_at?: string;
          user_id: string;
          viewports_config?: Json;
          worker_id?: string | null;
        };
        Update: {
          attempt_count?: number;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          crawl_depth?: number;
          created_at?: string;
          duration_ms?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          expires_at?: string | null;
          heartbeat_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          lease_expires_at?: string | null;
          max_attempts?: number;
          normalized_domain?: string;
          progress_percent?: number;
          started_at?: string | null;
          status?: string;
          target_url?: string;
          updated_at?: string;
          user_id?: string;
          viewports_config?: Json;
          worker_id?: string | null;
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
      analysis_results: {
        Row: {
          architecture_summary: string;
          confidence_score: number | null;
          created_at: string;
          design_token_summary: Json;
          detected_patterns: Json;
          evidence_coverage: Json;
          id: string;
          job_id: string;
          model_name: string;
          provider: string;
          raw_artifact_storage_key: string | null;
          updated_at: string;
        };
        Insert: {
          architecture_summary: string;
          confidence_score?: number | null;
          created_at?: string;
          design_token_summary?: Json;
          detected_patterns?: Json;
          evidence_coverage?: Json;
          id?: string;
          job_id: string;
          model_name: string;
          provider: string;
          raw_artifact_storage_key?: string | null;
          updated_at?: string;
        };
        Update: {
          architecture_summary?: string;
          confidence_score?: number | null;
          created_at?: string;
          design_token_summary?: Json;
          detected_patterns?: Json;
          evidence_coverage?: Json;
          id?: string;
          job_id?: string;
          model_name?: string;
          provider?: string;
          raw_artifact_storage_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analysis_results_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: true;
            referencedRelation: 'analysis_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      blueprint_artifacts: {
        Row: {
          analysis_result_id: string | null;
          antigravity_prompts: string;
          blueprint_storage_key: string | null;
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
          analysis_result_id?: string | null;
          antigravity_prompts?: string;
          blueprint_storage_key?: string | null;
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
          analysis_result_id?: string | null;
          antigravity_prompts?: string;
          blueprint_storage_key?: string | null;
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
          {
            foreignKeyName: 'blueprint_artifacts_analysis_result_id_fkey';
            columns: ['analysis_result_id'];
            isOneToOne: false;
            referencedRelation: 'analysis_results';
            referencedColumns: ['id'];
          },
        ];
      };
      discovered_pages: {
        Row: {
          depth: number;
          discovered_at: string;
          error_code: string | null;
          http_status: number | null;
          id: string;
          inspected_at: string | null;
          is_entry_page: boolean;
          job_id: string;
          normalized_url: string;
          status: string;
          url: string;
        };
        Insert: {
          depth?: number;
          discovered_at?: string;
          error_code?: string | null;
          http_status?: number | null;
          id?: string;
          inspected_at?: string | null;
          is_entry_page?: boolean;
          job_id: string;
          normalized_url: string;
          status?: string;
          url: string;
        };
        Update: {
          depth?: number;
          discovered_at?: string;
          error_code?: string | null;
          http_status?: number | null;
          id?: string;
          inspected_at?: string | null;
          is_entry_page?: boolean;
          job_id?: string;
          normalized_url?: string;
          status?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'discovered_pages_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'analysis_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      export_records: {
        Row: {
          created_at: string;
          downloaded_at: string | null;
          expires_at: string;
          file_hash: string | null;
          file_size_bytes: number | null;
          format: string;
          id: string;
          job_id: string;
          status: string;
          storage_key: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          downloaded_at?: string | null;
          expires_at?: string;
          file_hash?: string | null;
          file_size_bytes?: number | null;
          format: string;
          id?: string;
          job_id: string;
          status?: string;
          storage_key?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          downloaded_at?: string | null;
          expires_at?: string;
          file_hash?: string | null;
          file_size_bytes?: number | null;
          format?: string;
          id?: string;
          job_id?: string;
          status?: string;
          storage_key?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'export_records_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'analysis_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'export_records_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      implementation_prompts: {
        Row: {
          blueprint_id: string;
          created_at: string;
          id: string;
          is_edited_by_user: boolean;
          job_id: string;
          objective: string;
          phase_number: number;
          prompt_hash: string;
          prompt_markdown: string;
          target_tool: string;
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          blueprint_id: string;
          created_at?: string;
          id?: string;
          is_edited_by_user?: boolean;
          job_id: string;
          objective: string;
          phase_number: number;
          prompt_hash: string;
          prompt_markdown: string;
          target_tool?: string;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          blueprint_id?: string;
          created_at?: string;
          id?: string;
          is_edited_by_user?: boolean;
          job_id?: string;
          objective?: string;
          phase_number?: number;
          prompt_hash?: string;
          prompt_markdown?: string;
          target_tool?: string;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'implementation_prompts_blueprint_id_fkey';
            columns: ['blueprint_id'];
            isOneToOne: false;
            referencedRelation: 'blueprint_artifacts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'implementation_prompts_job_id_fkey';
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
      job_events: {
        Row: {
          attempt_number: number;
          created_at: string;
          event_type: string;
          from_status: string | null;
          id: string;
          idempotency_key: string | null;
          job_id: string;
          message: string;
          metadata: Json | null;
          to_status: string | null;
          worker_id: string | null;
        };
        Insert: {
          attempt_number?: number;
          created_at?: string;
          event_type: string;
          from_status?: string | null;
          id?: string;
          idempotency_key?: string | null;
          job_id: string;
          message: string;
          metadata?: Json | null;
          to_status?: string | null;
          worker_id?: string | null;
        };
        Update: {
          attempt_number?: number;
          created_at?: string;
          event_type?: string;
          from_status?: string | null;
          id?: string;
          idempotency_key?: string | null;
          job_id?: string;
          message?: string;
          metadata?: Json | null;
          to_status?: string | null;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'job_events_job_id_fkey';
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
          discovered_page_id: string | null;
          dom_node_count: number;
          dom_snapshot_storage_key: string | null;
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
          discovered_page_id?: string | null;
          dom_node_count?: number;
          dom_snapshot_storage_key?: string | null;
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
          discovered_page_id?: string | null;
          dom_node_count?: number;
          dom_snapshot_storage_key?: string | null;
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
          {
            foreignKeyName: 'page_evidence_discovered_page_id_fkey';
            columns: ['discovered_page_id'];
            isOneToOne: true;
            referencedRelation: 'discovered_pages';
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
          storage_bucket: string;
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
          storage_bucket?: string;
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
          storage_bucket?: string;
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
