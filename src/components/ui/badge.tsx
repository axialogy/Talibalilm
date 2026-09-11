import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]',
  {
    variants: {
      variant: {
        brand: 'bg-brand-500 text-white',
        soft: 'bg-brand-50 text-brand-700',
        gold: 'bg-gold-100 text-gold-700',
        muted: 'bg-surface text-ink-muted',
        outline: 'border border-line text-ink-muted',
        // Semantic states for the office screens — kept apart from the brand
        // accent so status reads at a glance, not by hue alone.
        success: 'bg-emerald-100 text-emerald-800',
        warn: 'bg-amber-100 text-amber-800',
        danger: 'bg-red-100 text-red-700',
      },
    },
    defaultVariants: { variant: 'brand' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
