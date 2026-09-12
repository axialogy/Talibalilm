'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireAdmin } from '@/lib/auth/guards';
import { reportError } from '@/lib/observability/report';
import { normalisePrefix, slugifyBatch } from '@/lib/commerce/batch';
import type { AdminState } from '@/app/actions/admin';

/**
 * Office operations — grant, revoke, and cash codes.
 *
 * These call security-definer RPCs through the ordinary authenticated client,
 * never the service role. The `is_admin()` check lives inside each RPC and the
 * audit row it writes names `auth.uid()`, so the trail records the real person
 * rather than an anonymous privileged write. `requireAdmin()` here is the
 * courtesy guard that keeps a non-admin from reaching the action at all; the
 * RPC is the control.
 */

const OK: AdminState = { ok: true };

async function admin() {
  if (!supabaseConfigured) throw new Error('unavailable');
  await requireAdmin();
  return createClient();
}

const grantSchema = z.object({
  userId: z.string().uuid(),
  scope: z.enum(['course', 'cursus', 'site']),
  courseId: z.string().uuid().nullable(),
  cursusId: z.string().uuid().nullable(),
  yearIndex: z.coerce.number().int().min(1).max(10),
  delivery: z.enum(['presentiel', 'online']),
  days: z.coerce.number().int().min(1).max(3650),
  reason: z.string().trim().min(3).max(200),
});

export async function grantEntitlement(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = grantSchema.safeParse({
    userId: formData.get('userId'),
    scope: formData.get('scope'),
    courseId: (formData.get('courseId') as string) || null,
    cursusId: (formData.get('cursusId') as string) || null,
    yearIndex: formData.get('yearIndex') || 1,
    delivery: formData.get('delivery'),
    days: formData.get('days') || 365,
    reason: formData.get('reason'),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  const g = parsed.data;
  // Scope determines which target the RPC reads; the other is passed null.
  if (g.scope === 'course' && !g.courseId) return { ok: false, error: 'targetRequired' };
  if (g.scope === 'cursus' && !g.cursusId) return { ok: false, error: 'targetRequired' };

  const supabase = await admin();
  const { error } = await supabase.rpc('admin_grant_entitlement', {
    target_user: g.userId,
    target_scope: g.scope,
    course_id: g.scope === 'course' ? g.courseId : null,
    cursus_id: g.scope === 'cursus' ? g.cursusId : null,
    year_index: g.yearIndex,
    delivery: g.delivery,
    days: g.days,
    reason: g.reason,
  });
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/students/[id]', 'page');
  return OK;
}

export async function revokeEntitlement(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ entitlementId: z.string().uuid(), reason: z.string().trim().min(3).max(200) })
    .safeParse({ entitlementId: formData.get('entitlementId'), reason: formData.get('reason') });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  const supabase = await admin();
  const { data, error } = await supabase.rpc('admin_revoke_entitlement', {
    entitlement_id: parsed.data.entitlementId,
    reason: parsed.data.reason,
  });
  if (error || data !== true) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/students/[id]', 'page');
  return OK;
}

export async function voidCoupon(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ couponId: z.string().uuid(), reason: z.string().trim().max(200).default('') })
    .safeParse({ couponId: formData.get('couponId'), reason: formData.get('reason') ?? '' });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await admin();
  const { error } = await supabase.rpc('admin_void_coupon', {
    coupon_id: parsed.data.couponId,
    reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/coupons', 'page');
  return OK;
}

/**
 * Correct a student's details.
 *
 * Through the ordinary client, so `profiles_update_admin` is the control — and
 * the column grants are the reason this cannot quietly become something worse:
 * `authenticated` may write full_name, phone and locale and nothing else, so
 * even a mistake here could not promote anyone to staff.
 *
 * The email is not editable from this screen. It is the login, it lives in
 * auth.users, and changing it silently would lock a student out of an account
 * they can still see the password for.
 */
export async function updateStudent(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({
      userId: z.string().uuid(),
      fullName: z.string().trim().max(120).default(''),
      phone: z.string().trim().max(32).default(''),
      locale: z.enum(['fr', 'en']).default('fr'),
    })
    .safeParse({
      userId: formData.get('userId'),
      fullName: formData.get('fullName') ?? '',
      phone: formData.get('phone') ?? '',
      locale: formData.get('locale') ?? 'fr',
    });
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await admin();
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.fullName,
      // The constraint wants null rather than an empty string.
      phone: parsed.data.phone || null,
      locale: parsed.data.locale,
    })
    .eq('id', parsed.data.userId);
  if (error) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/students/[id]', 'page');
  revalidatePath('/[locale]/admin/students', 'page');
  return OK;
}

/**
 * Delete a student account outright.
 *
 * Only for an account that never bought anything — a test signup, a duplicate,
 * a mistyped address. `orders.user_id` is `on delete restrict`, so the database
 * refuses to remove anyone whose purchases would be orphaned, and this checks
 * first so the office gets a sentence explaining why rather than a failed save.
 * For a student who did buy, erasure is the right tool: it scrubs the person and
 * keeps the sale.
 *
 * Deleting the auth user is what removes them; the profile, entitlements and
 * progress follow by cascade.
 */
export async function deleteStudent(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z.object({ userId: z.string().uuid() }).safeParse({
    userId: formData.get('userId'),
  });
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const { userId } = parsed.data;

  const supabase = await admin();

  // Never a colleague. Staff accounts are removed deliberately, not from the
  // student list.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return { ok: false, error: 'saveFailed' };
  if (profile.role !== 'student') return { ok: false, error: 'studentIsStaff' };

  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) > 0) return { ok: false, error: 'studentHasOrders' };

  try {
    const service = createAdminClient();
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;
  } catch (cause) {
    reportError('students.delete', cause, { userId });
    return { ok: false, error: 'saveFailed' };
  }

  revalidatePath('/[locale]/admin/students', 'page');
  return OK;
}

/**
 * Erase a student on request (GDPR B9).
 *
 * Two halves make one erasure. The RPC scrubs everything in `public` that names
 * the person — profile and live access — as the admin's own session, so the
 * audit records who ran it. Then the service-role Admin API scrubs the parts
 * only the auth admin may touch: the email becomes an unroutable token, the
 * metadata is emptied, and the login is banned so a dangling session cannot be
 * used. The order matters — the RPC is the authorisation gate, so nothing is
 * scrubbed in `auth` until it has said yes.
 *
 * The orders stay. `orders.user_id` is `on delete restrict` for exactly this
 * reason: the sale is the school's record, and it now points at a user who is
 * no longer identifiable.
 */
export async function anonymiseStudent(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const parsed = z
    .object({ userId: z.string().uuid(), reason: z.string().trim().min(3).max(200) })
    .safeParse({ userId: formData.get('userId'), reason: formData.get('reason') });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  const { userId, reason } = parsed.data;

  const supabase = await admin();
  const { data, error } = await supabase.rpc('admin_anonymise_user', {
    target_user: userId,
    reason,
  });
  if (error || data !== true) return { ok: false, error: 'saveFailed' };

  // The email and login live in auth.users, which only the auth admin may
  // write. `.invalid` is a reserved, unroutable TLD, so the token can never be
  // mistaken for a real address or receive mail.
  try {
    const service = createAdminClient();
    const { error: authError } = await service.auth.admin.updateUserById(userId, {
      email: `anonymised+${userId}@deleted.invalid`,
      phone: '',
      user_metadata: {},
      // A very long ban, standing in for "permanent": the person is gone, so no
      // future sign-in should succeed on this account.
      ban_duration: '876000h',
    });
    if (authError) throw authError;
  } catch (cause) {
    // The public-schema scrub already committed. Surface the failure so the
    // office retries — the whole operation is idempotent, so a second run
    // simply finishes the auth half.
    reportError('gdpr.anonymise.auth', cause, { userId });
    return { ok: false, error: 'partialErasure' };
  }

  revalidatePath('/[locale]/admin/students/[id]', 'page');
  revalidatePath('/[locale]/admin/students', 'page');
  return OK;
}

const couponBatchSchema = z
  .object({
    quantity: z.coerce.number().int().min(1).max(500),
    kind: z.enum(['office', 'percent', 'amount']),
    percentOff: z.coerce.number().int().min(1).max(100).nullable(),
    amountOff: z.coerce.number().min(0).nullable(),
    maxRedemptions: z.coerce.number().int().min(1).max(100000),
    // Normalised, not rejected: "October 2026" becomes october-2026 rather than
    // a red sentence next to the button that does not say which field it means.
    batch: z.string().trim().max(120).transform(slugifyBatch),
    prefix: z.string().trim().max(40).transform(normalisePrefix),
  })
  .refine((v) => v.kind !== 'percent' || v.percentOff !== null, { message: 'percentRequired' })
  .refine((v) => v.kind !== 'amount' || (v.amountOff !== null && v.amountOff > 0), {
    message: 'amountRequired',
  });

export interface GenerateState extends AdminState {
  /** Returned once, here — a code is worth nothing after it can be read back. */
  codes?: string[];
}

export async function generateCoupons(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const parsed = couponBatchSchema.safeParse({
    quantity: formData.get('quantity') || 1,
    kind: formData.get('kind'),
    percentOff: (formData.get('percentOff') as string) || null,
    amountOff: (formData.get('amountOff') as string) || null,
    maxRedemptions: formData.get('maxRedemptions') || 1,
    batch: formData.get('batch') ?? '',
    prefix: formData.get('prefix') ?? '',
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };

  const c = parsed.data;
  const supabase = await admin();
  const { data, error } = await supabase.rpc('admin_generate_coupons', {
    quantity: c.quantity,
    // An office code is 100% off; the other kinds carry their own discount.
    percent_off: c.kind === 'office' ? 100 : c.kind === 'percent' ? c.percentOff : null,
    amount_off_cents: c.kind === 'amount' ? Math.round((c.amountOff ?? 0) * 100) : null,
    max_redemptions: c.maxRedemptions,
    is_office: c.kind === 'office',
    batch: c.batch,
    code_prefix: c.prefix,
    expires_at: null,
  });
  if (error || !data) return { ok: false, error: 'saveFailed' };

  revalidatePath('/[locale]/admin/coupons', 'page');
  return { ok: true, codes: data };
}
