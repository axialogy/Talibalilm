import type { OrderStatus } from '@/types';
import type { TranslationKey } from '@/i18n/en';

/** The lifecycle, in the order the admin moves an order through it. */
export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
];

const KEYS: Record<OrderStatus, TranslationKey> = {
  pending: 'statusPending',
  confirmed: 'statusConfirmed',
  packed: 'statusPacked',
  shipped: 'statusShipped',
  delivered: 'statusDelivered',
  cancelled: 'statusCancelled',
};

const TONES: Record<OrderStatus, 'neutral' | 'warn' | 'info' | 'good' | 'bad'> = {
  pending: 'warn',
  confirmed: 'info',
  packed: 'info',
  shipped: 'info',
  delivered: 'good',
  cancelled: 'bad',
};

export function statusKey(status: OrderStatus): TranslationKey {
  return KEYS[status] ?? 'statusPending';
}

export function statusTone(status: OrderStatus) {
  return TONES[status] ?? 'neutral';
}
