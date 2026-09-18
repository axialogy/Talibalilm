'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { Search } from 'lucide-react';

/**
 * The student search, filtering as the office types.
 *
 * Debounced, and the query still lives in the URL: the list stays
 * server-rendered and RLS-filtered, and a result is still a link somebody can
 * send. Typing "you" fires one request, not three.
 */
export function LiveSearch({
  action,
  defaultValue,
  placeholder,
  label,
}: {
  action: string;
  defaultValue: string;
  placeholder: string;
  label: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = value.trim();
      router.replace(query ? `${action}?q=${encodeURIComponent(query)}` : action);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // `router` and `action` are stable; only the typed value should re-arm it.
  }, [value, action, router]);

  return (
    <label className="relative mt-6 block max-w-md">
      <span className="sr-only">{label}</span>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-[var(--radius-input)] border border-line bg-white ps-10 pe-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400"
      />
    </label>
  );
}
