'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Sections of one screen, in tabs.
 *
 * Everything about a course — or a cursus — now lives on its own page, which is
 * right, but stacked in one column it is a very long scroll. Tabs keep "where
 * do I set the price?" a one-click answer instead of a hunt.
 *
 * State only, no routing: switching tabs must not reload the page and lose an
 * unsaved lesson body. Panels stay mounted and are hidden, so a half-typed form
 * survives a glance at another tab.
 */
export function Tabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');

  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-line" role="tablist">
        {tabs.map((tab) => {
          const on = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(tab.key)}
              className={cn(
                '-mb-px border-b-2 px-4 py-2.5 text-[13px] transition-colors',
                on
                  ? 'border-brand-500 font-medium text-brand-700'
                  : 'border-transparent text-ink-muted hover:text-brand-600',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" hidden={tab.key !== active} className="pt-6">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
