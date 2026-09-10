/**
 * Database types.
 *
 * Hand-written to match `supabase/migrations/`, because no Supabase project is
 * connected yet. Once one is, `npm run db:types` regenerates this file from
 * the live schema and that output wins — do not edit it by hand after that.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'student' | 'instructor' | 'admin';
export type AppLocale = 'fr' | 'ar';

export type CourseLevel = 'all' | 'beginner' | 'intermediate' | 'advanced';
export type CourseFormat = 'presentiel' | 'visio' | 'hybride';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type LessonType = 'video' | 'text' | 'live' | 'quiz' | 'assignment';
export type VideoProvider = 'bunny' | 'youtube' | 'none';
export type MembershipStatus = 'active' | 'expired' | 'cancelled';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';


export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          locale: AppLocale;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          locale?: AppLocale;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        // `role` is deliberately absent: `authenticated` has no column grant
        // for it, so a client-side update including it fails at the database.
        // Role changes go through an admin action using the service-role
        // client. Leaving it out of the type stops the mistake at compile time
        // as well as at runtime.
        Update: {
          full_name?: string;
          phone?: string | null;
          locale?: AppLocale;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
            isOneToOne: true;
          },
        ];
      };
      courses: {
        Row: {
          id: string;
          slug: string;
          title: string;
          subtitle: string;
          description: string;
          title_ar: string;
          cover_url: string | null;
          tone: string;
          category: string;
          level: CourseLevel;
          format: CourseFormat;
          language: string;
          instructor_id: string | null;
          status: CourseStatus;
          published_at: string | null;
          display_order: number;
          schedule: string;
          duration_weeks: number;
          objectives: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['courses']['Row']> & { slug: string; title: string };
        Update: Partial<Database['public']['Tables']['courses']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'courses_instructor_id_fkey';
            columns: ['instructor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      modules: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; course_id: string; title: string; position?: number };
        Update: { title?: string; position?: number };
        Relationships: [
          {
            foreignKeyName: 'modules_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
        ];
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          slug: string;
          type: LessonType;
          position: number;
          duration_seconds: number;
          is_preview: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          slug: string;
          type?: LessonType;
          position?: number;
          duration_seconds?: number;
          is_preview?: boolean;
        };
        Update: {
          title?: string;
          slug?: string;
          type?: LessonType;
          position?: number;
          duration_seconds?: number;
          is_preview?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'lessons_module_id_fkey';
            columns: ['module_id'];
            isOneToOne: false;
            referencedRelation: 'modules';
            referencedColumns: ['id'];
          },
        ];
      };
      // The gated half. A non-member's select returns zero rows — there is no
      // request shape that yields `content` or `video_id`.
      lesson_content: {
        Row: {
          lesson_id: string;
          content: string;
          video_provider: VideoProvider;
          video_id: string | null;
          attachments: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          lesson_id: string;
          content?: string;
          video_provider?: VideoProvider;
          video_id?: string | null;
          attachments?: Json;
        };
        Update: {
          content?: string;
          video_provider?: VideoProvider;
          video_id?: string | null;
          attachments?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_content_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: true;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
      memberships: {
        Row: {
          id: string;
          user_id: string;
          status: MembershipStatus;
          starts_at: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        // No client-writable shape: granting membership is a service-role
        // action from a verified payment or an audited admin action.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      enrollments: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          enrolled_at: string;
          last_accessed_at: string;
        };
        Insert: { user_id: string; course_id: string; last_accessed_at?: string };
        Update: { last_accessed_at?: string };
        Relationships: [
          {
            foreignKeyName: 'enrollments_course_id_fkey';
            columns: ['course_id'];
            isOneToOne: false;
            referencedRelation: 'courses';
            referencedColumns: ['id'];
          },
        ];
      };
      lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          status: ProgressStatus;
          seconds_watched: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          lesson_id: string;
          status?: ProgressStatus;
          seconds_watched?: number;
          completed_at?: string | null;
        };
        Update: {
          status?: ProgressStatus;
          seconds_watched?: number;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lesson_progress_lesson_id_fkey';
            columns: ['lesson_id'];
            isOneToOne: false;
            referencedRelation: 'lessons';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      user_role: {
        Args: { uid?: string };
        Returns: UserRole;
      };
      is_staff: {
        Args: { uid?: string };
        Returns: boolean;
      };
      is_admin: {
        Args: { uid?: string };
        Returns: boolean;
      };
      has_active_membership: {
        Args: { uid?: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      app_locale: AppLocale;
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type CourseRow = Database['public']['Tables']['courses']['Row'];
export type ModuleRow = Database['public']['Tables']['modules']['Row'];
export type LessonRow = Database['public']['Tables']['lessons']['Row'];
export type LessonContentRow = Database['public']['Tables']['lesson_content']['Row'];
export type MembershipRow = Database['public']['Tables']['memberships']['Row'];
export type ProgressRow = Database['public']['Tables']['lesson_progress']['Row'];
