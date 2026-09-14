import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import type { DeliveryMode, OrderStatus, PaymentRoute } from '@/lib/supabase/database.types';

/**
 * Reads for the office screens.
 *
 * Everything goes through the ordinary authenticated client, so the staff and
 * admin RLS policies decide what comes back — the admin layout has already
 * confirmed the viewer is staff, and these reads confirm it again at the
 * database. The one thing RLS cannot serve is a student's email, which lives
 * in `auth.users`; `emails_for` (staff-gated, security definer) fills that in.
 */

async function attachEmails<T extends { userId: string }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: T[],
): Promise<(T & { email: string | null })[]> {
  const ids = [...new Set(rows.map((r) => r.userId))];
  if (ids.length === 0) return rows.map((r) => ({ ...r, email: null }));

  const { data } = await supabase.rpc('emails_for', { ids });
  const byId = new Map((data ?? []).map((r) => [r.id, r.email]));
  return rows.map((r) => ({ ...r, email: byId.get(r.userId) ?? null }));
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderSummary {
  id: string;
  userId: string;
  email: string | null;
  status: OrderStatus;
  route: PaymentRoute;
  delivery: DeliveryMode;
  totalCents: number;
  currency: string;
  statusReason: string;
  createdAt: string;
  paidAt: string | null;
}

export interface OrderListOptions {
  status?: OrderStatus;
  /** ISO date; orders created on or after midnight of this day. */
  since?: string;
  limit?: number;
}

export async function listOrders(options: OrderListOptions = {}): Promise<OrderSummary[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();

  let query = supabase
    .from('orders')
    .select(
      'id, user_id, status, route, delivery, total_cents, currency, status_reason, created_at, paid_at',
    )
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);

  if (options.status) query = query.eq('status', options.status);
  if (options.since) query = query.gte('created_at', `${options.since}T00:00:00Z`);

  const { data } = await query;
  const rows = (data ?? []).map((o) => ({
    id: o.id,
    userId: o.user_id,
    status: o.status,
    route: o.route,
    delivery: o.delivery,
    totalCents: o.total_cents,
    currency: o.currency,
    statusReason: o.status_reason,
    createdAt: o.created_at,
    paidAt: o.paid_at,
  }));
  return attachEmails(supabase, rows);
}

export interface OrderDetail extends OrderSummary {
  providerOrderId: string | null;
  providerCaptureId: string | null;
  couponId: string | null;
  /** The code as typed at the desk, not the id — the id means nothing to a person. */
  couponCode: string | null;
  packId: string | null;
  packTitle: string | null;
  subtotalCents: number;
  discountCents: number;
  /** What this order actually opened, which is the question an office asks. */
  granted: { label: string; expiresAt: string; status: string }[];
  items: {
    productId: string;
    title: string;
    scheduleLabel: string;
    kind: string;
    delivery: DeliveryMode;
    unitPriceCents: number;
    durationDays: number;
    isFree: boolean;
  }[];
}

export async function getOrder(orderId: string): Promise<OrderDetail | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();

  const { data: o } = await supabase
    .from('orders')
    .select(
      `id, user_id, status, route, delivery, total_cents, currency, status_reason,
       created_at, paid_at, provider_order_id, provider_capture_id, coupon_id, pack_id,
       subtotal_cents, discount_cents,
       order_items ( product_id, title, schedule_label, kind, delivery, unit_price_cents,
                     duration_days, is_free )`,
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!o) return null;

  // Fetched beside the order rather than joined: the coupon and pack links are
  // nullable and the embedded form would need a declared relationship for a
  // reference that is usually absent.
  const [[withEmail], { data: entitlements }, { data: coupon }, { data: pack }] = await Promise.all(
    [
      attachEmails(supabase, [{ userId: o.user_id, id: o.id }]),
      // What the order opened. Reading it back rather than inferring it from the
      // line items means the screen shows what the student actually holds, even
      // if a grant was later revoked or wound back by a refund.
      supabase
        .from('entitlements')
        .select('scope, year_index, status, expires_at, courses ( title ), cursus ( title )')
        .eq('source_order_id', orderId),
      o.coupon_id
        ? supabase.from('coupons').select('code').eq('id', o.coupon_id).maybeSingle()
        : Promise.resolve({ data: null }),
      o.pack_id
        ? supabase.from('packs').select('title').eq('id', o.pack_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ],
  );

  return {
    id: o.id,
    userId: o.user_id,
    email: withEmail?.email ?? null,
    status: o.status,
    route: o.route,
    delivery: o.delivery,
    totalCents: o.total_cents,
    currency: o.currency,
    statusReason: o.status_reason,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    providerOrderId: o.provider_order_id,
    providerCaptureId: o.provider_capture_id,
    couponId: o.coupon_id,
    couponCode: coupon?.code ?? null,
    packId: o.pack_id,
    packTitle: pack?.title ?? null,
    subtotalCents: o.subtotal_cents,
    discountCents: o.discount_cents,
    granted: (entitlements ?? []).map((e) => ({
      label:
        e.courses?.title ?? (e.cursus?.title ? `${e.cursus.title} — ${e.year_index}` : 'Institut'),
      expiresAt: e.expires_at,
      status: e.status,
    })),
    items: (o.order_items ?? []).map((i) => ({
      productId: i.product_id,
      title: i.title,
      scheduleLabel: i.schedule_label,
      kind: i.kind,
      delivery: i.delivery,
      unitPriceCents: i.unit_price_cents,
      durationDays: i.duration_days,
      isFree: i.is_free,
    })),
  };
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export interface StudentSummary {
  userId: string;
  email: string | null;
  fullName: string;
  role: string;
  createdAt: string;
  anonymisedAt: string | null;
  /** When the office marked this registration as seen. Null means new. */
  reviewedAt: string | null;
  activeEntitlements: number;
  /**
   * What they are enrolled on, in words — the module titles, or the cursus.
   *
   * The list used to show only a count, which answers "how many" and not the
   * question the office actually asks a student list: who is doing what. A
   * number tells you to open the row to find out.
   */
  enrolledIn: string[];
}

/** The extra detail the account panel needs, on the detail screen only. */
export interface StudentAccountDetail {
  phone: string;
  locale: string;
  hasOrders: boolean;
}

export async function listStudents(search?: string): Promise<StudentSummary[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();

  // Students only. The teacher and any instructor are staff, not customers, and
  // listing them here made the school's own accounts look like enrolments —
  // wrong in the count, and one careless click away from the erase button.
  let query = supabase
    .from('profiles')
    .select('id, full_name, role, created_at, anonymised_at, reviewed_at')
    .eq('role', 'student')
    .order('created_at', { ascending: false })
    .limit(200);

  // A name search is served by the profiles policy; an email search needs the
  // directory, so it is resolved separately below.
  if (search && !search.includes('@')) query = query.ilike('full_name', `%${search}%`);

  const { data: profiles } = await query;
  const rows = (profiles ?? []).map((p) => ({
    userId: p.id,
    fullName: p.full_name,
    role: p.role,
    createdAt: p.created_at,
    anonymisedAt: p.anonymised_at,
    reviewedAt: p.reviewed_at,
  }));

  const withEmail = await attachEmails(supabase, rows);

  const emailNeedle = search?.includes('@') ? search.toLowerCase() : null;
  const filtered = emailNeedle
    ? withEmail.filter((r) => (r.email ?? '').toLowerCase().includes(emailNeedle))
    : withEmail;

  // Live entitlements per student, in ONE read, with the titles joined rather
  // than fetched per row — a list of two hundred students must not become two
  // hundred queries.
  const { data: ents } = await supabase
    .from('entitlements')
    .select('user_id, scope, year_index, courses ( title ), cursus ( title )')
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString());

  const activeByUser = new Map<string, number>();
  const namesByUser = new Map<string, string[]>();
  for (const e of ents ?? []) {
    activeByUser.set(e.user_id, (activeByUser.get(e.user_id) ?? 0) + 1);

    // A cursus entitlement names the year as well: "Approfondi — année 2" is
    // the useful fact, and "Approfondi" alone is not.
    const label =
      e.scope === 'cursus'
        ? `${e.cursus?.title ?? ''}${e.year_index > 1 ? ` · ${e.year_index}` : ''}`.trim()
        : (e.courses?.title ?? '');
    if (!label) continue;
    const list = namesByUser.get(e.user_id) ?? [];
    if (!list.includes(label)) list.push(label);
    namesByUser.set(e.user_id, list);
  }

  return filtered.map((r) => ({
    ...r,
    activeEntitlements: activeByUser.get(r.userId) ?? 0,
    enrolledIn: namesByUser.get(r.userId) ?? [],
  }));
}

export interface StudentEntitlement {
  id: string;
  scope: string;
  label: string;
  delivery: DeliveryMode;
  status: string;
  startsAt: string;
  expiresAt: string;
  note: string;
  sourceOrderId: string | null;
}

export async function getStudent(userId: string): Promise<{
  student: StudentSummary;
  account: StudentAccountDetail;
  entitlements: StudentEntitlement[];
} | null> {
  if (!supabaseConfigured) return null;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at, anonymised_at, reviewed_at, phone, locale')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;

  // Whether they ever bought decides if the account can be deleted at all.
  const { count: orderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  const [withEmail] = await attachEmails(supabase, [{ userId: profile.id, id: profile.id }]);

  const { data: ents } = await supabase
    .from('entitlements')
    .select(
      `id, scope, delivery, status, starts_at, expires_at, note, source_order_id, year_index,
       courses ( title ), cursus ( title )`,
    )
    .eq('user_id', userId)
    .order('expires_at', { ascending: false });

  const now = Date.now();
  return {
    account: {
      phone: profile.phone ?? '',
      locale: profile.locale,
      hasOrders: (orderCount ?? 0) > 0,
    },
    student: {
      userId: profile.id,
      email: withEmail?.email ?? null,
      fullName: profile.full_name,
      role: profile.role,
      createdAt: profile.created_at,
      anonymisedAt: profile.anonymised_at,
      reviewedAt: profile.reviewed_at,
      activeEntitlements: (ents ?? []).filter(
        (e) => e.status === 'active' && new Date(e.expires_at).getTime() > now,
      ).length,
      // The detail page lists every entitlement in full underneath, so the
      // summary line it shares with the list view has nothing to add here.
      enrolledIn: [],
    },
    entitlements: (ents ?? []).map((e) => ({
      id: e.id,
      scope: e.scope,
      label:
        e.courses?.title ??
        (e.cursus?.title ? `${e.cursus.title} — année ${e.year_index}` : 'Tout l’institut'),
      delivery: e.delivery,
      status: e.status,
      startsAt: e.starts_at,
      expiresAt: e.expires_at,
      note: e.note,
      sourceOrderId: e.source_order_id,
    })),
  };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export interface CouponRowView {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  isOffice: boolean;
  batch: string;
  expiresAt: string | null;
  createdAt: string;
  spent: boolean;
}

export async function listCoupons(batch?: string): Promise<CouponRowView[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();

  let query = supabase
    .from('coupons')
    .select(
      'id, code, percent_off, amount_off_cents, max_redemptions, redeemed_count, is_office, batch, expires_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(500);
  if (batch) query = query.eq('batch', batch);

  const { data } = await query;
  const now = Date.now();
  return (data ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    percentOff: c.percent_off,
    amountOffCents: c.amount_off_cents,
    maxRedemptions: c.max_redemptions,
    redeemedCount: c.redeemed_count,
    isOffice: c.is_office,
    batch: c.batch,
    expiresAt: c.expires_at,
    createdAt: c.created_at,
    spent:
      (c.max_redemptions !== null && c.redeemed_count >= c.max_redemptions) ||
      (c.expires_at !== null && new Date(c.expires_at).getTime() <= now),
  }));
}

/** The distinct batch names, for the filter. */
export async function couponBatches(): Promise<string[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.from('coupons').select('batch').neq('batch', '').limit(1000);
  return [...new Set((data ?? []).map((c) => c.batch))].sort();
}

// ---------------------------------------------------------------------------
// Who has paid, and who has not finished paying
// ---------------------------------------------------------------------------

/** Where one student stands with the school's till. */
export type PaymentStanding = 'paid' | 'partial' | 'pending';

export interface StudentPayment {
  userId: string;
  email: string | null;
  fullName: string;
  /** Settled, in cents. Refunds are not deducted — they show as their own row. */
  paidCents: number;
  /** Opened and not settled: a checkout left half-way, or an instalment due. */
  outstandingCents: number;
  currency: string;
  orders: number;
  lastPaidAt: string | null;
  standing: PaymentStanding;
}

/**
 * The payments screen, by student rather than by order.
 *
 * "Who has paid me?" is a question about people, and the orders table answers a
 * question about transactions. This folds one into the other: every order a
 * student has opened, settled ones summed as paid and open ones as
 * outstanding.
 *
 * `standing` is derived rather than stored: a student with money settled and
 * nothing open has PAID; one with both has paid PART of what they started; one
 * with only open orders has not paid yet. When instalments land, a plan that is
 * one third settled is exactly the middle case and will read as partial here
 * without this function changing.
 *
 * Refunded and cancelled orders count as neither. A refund is not a debt the
 * student owes, and a cancelled checkout is not a sale — showing either as
 * outstanding would put the office on the phone to someone who owes nothing.
 */
export async function studentPayments(): Promise<StudentPayment[]> {
  if (!supabaseConfigured) return [];
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select('user_id, status, total_cents, currency, paid_at')
    .in('status', ['paid', 'pending'])
    .order('created_at', { ascending: false })
    .limit(2000);

  const byUser = new Map<string, StudentPayment>();
  for (const order of orders ?? []) {
    const current = byUser.get(order.user_id) ?? {
      userId: order.user_id,
      email: null,
      fullName: '',
      paidCents: 0,
      outstandingCents: 0,
      currency: order.currency,
      orders: 0,
      lastPaidAt: null,
      standing: 'pending' as PaymentStanding,
    };

    current.orders += 1;
    if (order.status === 'paid') {
      current.paidCents += order.total_cents;
      // The list is newest first, so the first settled row seen is the latest.
      current.lastPaidAt ??= order.paid_at;
    } else {
      current.outstandingCents += order.total_cents;
    }
    byUser.set(order.user_id, current);
  }

  const rows = [...byUser.values()].map((row) => ({
    ...row,
    standing:
      row.paidCents > 0 && row.outstandingCents > 0
        ? ('partial' as const)
        : row.paidCents > 0
          ? ('paid' as const)
          : ('pending' as const),
  }));

  if (rows.length === 0) return [];

  // Names come from `profiles` and emails from the staff-gated function; both
  // are reads the office is entitled to and neither is guessed from the other.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in(
      'id',
      rows.map((r) => r.userId),
    );
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? '']));

  const withEmails = await attachEmails(supabase, rows);
  return withEmails
    .map((row) => ({ ...row, fullName: names.get(row.userId) ?? '' }))
    .sort((a, b) => b.paidCents + b.outstandingCents - (a.paidCents + a.outstandingCents));
}
