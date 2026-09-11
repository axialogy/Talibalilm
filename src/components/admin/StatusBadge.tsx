import { Badge } from '@/components/ui/badge';
import type { OrderStatus } from '@/lib/supabase/database.types';

/** Order status, coloured by what it means rather than by the brand hue. */
const VARIANT: Record<OrderStatus, 'success' | 'warn' | 'danger' | 'muted'> = {
  paid: 'success',
  pending: 'warn',
  failed: 'danger',
  refunded: 'danger',
  cancelled: 'muted',
};

export function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <Badge variant={VARIANT[status]}>{label}</Badge>;
}
