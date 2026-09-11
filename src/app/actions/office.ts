'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { requireAdmin } from '@/lib/auth/guards';
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

const couponBatchSchema = z
  .object({
    quantity: z.coerce.number().int().min(1).max(500),
    kind: z.enum(['office', 'percent', 'amount']),
    percentOff: z.coerce.number().int().min(1).max(100).nullable(),
    amountOff: z.coerce.number().min(0).nullable(),
    maxRedemptions: z.coerce.number().int().min(1).max(100000),
    batch: z
      .string()
      .trim()
      .max(60)
      .regex(/^[a-z0-9-]*$/i, 'slugShape'),
    prefix: z
      .string()
      .trim()
      .max(12)
      .regex(/^[A-Za-z0-9-]*$/, 'slugShape'),
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
