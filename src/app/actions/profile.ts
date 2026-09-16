'use server';

import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { profileDetailsSchema } from '@/lib/validation/profile';
import { reportError } from '@/lib/observability/report';

/**
 * Saving the student's enrolment details.
 *
 * The write goes through the ordinary client on purpose: `profiles_update_own`
 * and the column grants are what decide whether it lands, and both are
 * covered by the policy tests. The service role is not used here — this is a
 * student editing their own row, not staff editing someone else's.
 *
 * The full name is kept in step with the first and last names: `full_name` is
 * what the dashboard, the emails and the admin screens already read, and a
 * second name that disagrees with the first is worse than either.
 */
export interface ProfileState {
  ok: boolean;
  /** Already-localised sentence. */
  message?: string;
  fieldErrors?: Record<string, string>;
}

async function resolveFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Promise<Record<string, string>> {
  const t = await getTranslations();
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? 'form');
    if (out[field]) continue;
    out[field] = issue.message.includes('.') ? t(issue.message) : issue.message;
  }
  return out;
}

export async function saveCheckoutProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const parsed = profileDetailsSchema.safeParse({
    civility: formData.get('civility'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    phoneLandline: formData.get('phoneLandline') ?? '',
    birthDate: formData.get('birthDate'),
    address: formData.get('address'),
    postalCode: formData.get('postalCode'),
    city: formData.get('city'),
    department: formData.get('department'),
  });

  // A Zod failure names the field it came from; a raw dump would be noise.
  if (!parsed.success) return { ok: false, fieldErrors: await resolveFieldErrors(parsed.error.issues) };

  // The write is the student's own row and RLS is the real control, but a
  // form post is still a request: cap how often one caller can make it.
  const { ok } = await rateLimit(clientKey(await headers(), 'profile-save'), {
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!ok) return { ok: false, message: (await getTranslations('checkout'))('rateLimited') };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: (await getTranslations('checkout'))('loginRequired') };

  const details = parsed.data;
  const { error } = await supabase
    .from('profiles')
    .update({
      civility: details.civility,
      first_name: details.firstName,
      last_name: details.lastName,
      full_name: `${details.firstName} ${details.lastName}`.trim(),
      phone: details.phone,
      phone_landline: details.phoneLandline === '' ? null : details.phoneLandline,
      birth_date: details.birthDate,
      address: details.address,
      postal_code: details.postalCode,
      city: details.city,
      department: details.department,
    })
    .eq('id', user.id);

  if (error) {
    // Student-facing: the evidence goes to the log, not to the screen. They
    // cannot act on a Postgres code, and the admin screens are where a cause
    // is meant to be read.
    reportError('profile.save', error, { userId: user.id });
    return { ok: false, message: (await getTranslations('common'))('error') };
  }

  return { ok: true };
}
