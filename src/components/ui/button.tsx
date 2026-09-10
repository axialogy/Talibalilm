import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Emerald is the only filled variant. Gold is the institute's identity colour
 * and never becomes a button — two filled accents on one screen stop telling
 * the reader which one is the action.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-semibold uppercase tracking-[0.12em] transition-all duration-300 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-white hover:bg-brand-600 hover:shadow-brand',
        outline: 'border border-brand-500 text-brand-600 hover:bg-brand-500 hover:text-white',
        ghost: 'text-ink-muted hover:bg-brand-50 hover:text-brand-600',
        subtle: 'bg-surface text-ink hover:bg-accent',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-9 px-4 text-[11px] [&_svg]:size-3.5',
        md: 'h-11 px-6 text-xs [&_svg]:size-4',
        lg: 'h-13 px-8 text-[13px] [&_svg]:size-4',
        icon: 'size-10 rounded-full p-0 [&_svg]:size-4',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

export { buttonVariants };
