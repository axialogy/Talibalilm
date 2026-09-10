import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import type { UserRole } from '@/lib/supabase/database.types';

export interface Viewer {
  id: string;
  email: string | null;
  fullName: string;
  role: UserRole;
}

/**
 * The signed-in user, or null.
 *
 * `getUser()` rather than `getSession()`: the latter trusts the cookie as-is,
 * while this revalidates the JWT against the auth server. Anywhere a decision
 * hangs on identity, that difference is the whole guarantee.
 */
export async function currentViewer(): Promise<Viewer | null> {
  if (!supabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? '',
    role: profile?.role ?? 'student',
  };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer) redirect('/login');
  return viewer;
}

/**
 * Staff-only pages.
 *
 * A convenience, not the control. Every table the admin touches carries an
 * `is_staff()` policy, so a student who somehow reached the page would still
 * be refused by the database on every read and write.
 */
export async function requireStaff(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.role !== 'instructor' && viewer.role !== 'admin') redirect('/dashboard');
  return viewer;
}
