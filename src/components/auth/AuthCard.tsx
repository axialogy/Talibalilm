import type { ReactNode } from 'react';

export function AuthCard({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="hero-wash min-h-[70vh] py-16 sm:py-20">
      <div className="shell max-w-md">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-7 shadow-card sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          {lead && <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{lead}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[13px] text-ink-muted">{footer}</div>}
      </div>
    </section>
  );
}

/** A form-level message. `tone` decides colour; the role makes it announced. */
export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-[var(--radius-input)] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700'
          : 'rounded-[var(--radius-input)] border border-brand-200 bg-brand-50 px-4 py-3 text-[13px] text-brand-700'
      }
    >
      {children}
    </p>
  );
}
