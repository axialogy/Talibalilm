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
    };
    Enums: {
      user_role: UserRole;
      app_locale: AppLocale;
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
