import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

/**
 * The student's own enrolment details.
 *
 * Read through the ordinary client: `profiles_select_own` lets a signed-in
 * student see exactly their row, and the email comes from the auth user
 * because that is where it lives. Nothing here is cached — it is one person's
 * record, not the catalogue.
 */

export interface StudentProfile {
  email: string | null;
  civility: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneLandline: string | null;
  /** `YYYY-MM-DD`, as Postgres returns a date. */
  birthDate: string | null;
  address: string;
  postalCode: string;
  city: string;
  department: string;
}

export async function getStudentProfile(): Promise<StudentProfile | null> {
  if (!supabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select(
      'civility, first_name, last_name, phone, phone_landline, birth_date, address, postal_code, city, department',
    )
    .eq('id', user.id)
    .maybeSingle();

  if (!data) return null;

  return {
    email: user.email ?? null,
    civility: data.civility,
    firstName: data.first_name,
    lastName: data.last_name,
    phone: data.phone,
    phoneLandline: data.phone_landline,
    birthDate: data.birth_date,
    address: data.address,
    postalCode: data.postal_code,
    city: data.city,
    department: data.department,
  };
}

/**
 * Is the enrolment complete enough to take a payment?
 *
 * The same fields the form marks required, checked on the server so a
 * hand-posted action cannot pay on a half-filled profile. The email is not
 * checked: it belongs to the account, not to this form.
 */
export function profileComplete(profile: StudentProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.civility !== null &&
    profile.firstName.trim() !== '' &&
    profile.lastName.trim() !== '' &&
    (profile.phone ?? '').trim() !== '' &&
    profile.birthDate !== null &&
    profile.address.trim() !== '' &&
    profile.postalCode.trim() !== '' &&
    profile.city.trim() !== '' &&
    profile.department.trim() !== ''
  );
}
