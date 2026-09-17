import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

/**
 * The student's own payment plans.
 *
 * Read through the ordinary client: `orders_select_own` and
 * `installments_select_own` decide what comes back, so this cannot show
 * somebody else's schedule even if it were asked to. No service role here.
 */

export interface InstallmentView {
  id: string;
  sequence: number;
  amountCents: number;
  dueAt: string;
  status: 'pending' | 'paid' | 'cancelled';
  /** Due, unpaid, and past its date — the door is closed while this is true. */
  overdue: boolean;
}

export interface PaymentPlan {
  orderId: string;
  titles: string[];
  totalCents: number;
  paidCents: number;
  currency: string;
  installments: InstallmentView[];
  /** The next one to pay, if any. */
  next: InstallmentView | null;
  overdue: InstallmentView | null;
}

export async function listPaymentPlans(): Promise<PaymentPlan[]> {
  if (!supabaseConfigured) return [];

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from('orders')
    .select('id, total_cents, paid_cents, currency, status, plan_size')
    .gt('plan_size', 1)
    .eq('status', 'paid')
    .order('created_at', { ascending: false });

  if (!orders || orders.length === 0) return [];

  const ids = orders.map((order) => order.id);
  const [{ data: installments }, { data: items }] = await Promise.all([
    supabase
      .from('installments')
      .select('id, order_id, sequence, amount_cents, due_at, status')
      .in('order_id', ids)
      .order('sequence', { ascending: true }),
    supabase.from('order_items').select('order_id, title').in('order_id', ids),
  ]);

  const titlesByOrder = new Map<string, string[]>();
  for (const item of items ?? []) {
    const list = titlesByOrder.get(item.order_id) ?? [];
    if (!list.includes(item.title)) list.push(item.title);
    titlesByOrder.set(item.order_id, list);
  }

  const now = Date.now();

  return orders.map((order) => {
    const rows: InstallmentView[] = (installments ?? [])
      .filter((row) => row.order_id === order.id)
      .map((row) => ({
        id: row.id,
        sequence: row.sequence,
        amountCents: row.amount_cents,
        dueAt: row.due_at,
        status: row.status,
        overdue: row.status === 'pending' && new Date(row.due_at).getTime() < now,
      }));

    const pending = rows.filter((row) => row.status === 'pending');

    return {
      orderId: order.id,
      titles: titlesByOrder.get(order.id) ?? [],
      totalCents: order.total_cents,
      paidCents: order.paid_cents,
      currency: order.currency,
      installments: rows,
      next: pending[0] ?? null,
      overdue: pending.find((row) => row.overdue) ?? null,
    };
  });
}
