'use client';

import { useRef, type ReactNode } from 'react';

/**
 * A filter bar that applies itself.
 *
 * The office asked for no submit button: picking a value IS the action. The
 * form still lives in the URL — `requestSubmit` is a real submission — so a
 * filtered view stays a shareable link and the page stays server-rendered.
 */
export function AutoFilterForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} className={className} onChange={() => form.current?.requestSubmit()}>
      {children}
    </form>
  );
}
