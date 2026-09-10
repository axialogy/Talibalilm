'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import type { CourseCategory, CourseLevel } from '@/lib/content/types';
import { cn } from '@/lib/utils';

/**
 * Filter chips rendered as links rather than buttons.
 *
 * Each one is a real URL, so the filtered catalogue is crawlable and
 * shareable, back works, and the page needs no client-side data fetching. The
 * component is a Client Component only to read the current query string.
 */
export function CourseFilters({
  categories,
  levels,
  activeCategory,
  activeLevel,
}: {
  categories: CourseCategory[];
  levels: CourseLevel[];
  activeCategory: CourseCategory | null;
  activeLevel: CourseLevel | null;
}) {
  const t = useTranslations('courses');
  const searchParams = useSearchParams();

  /** Build the query for toggling one facet, preserving the other. */
  const queryWith = (key: 'category' | 'level', value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    return Object.fromEntries(next.entries());
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Chip href={queryWith('category', null)} active={activeCategory === null}>
          {t('filterAll')}
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c}
            href={queryWith('category', activeCategory === c ? null : c)}
            active={activeCategory === c}
          >
            {t(`category.${c}`)}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-muted">{t('filterLevel')}</span>
        <Chip href={queryWith('level', null)} active={activeLevel === null} small>
          {t('filterAllLevels')}
        </Chip>
        {levels.map((l) => (
          <Chip
            key={l}
            href={queryWith('level', activeLevel === l ? null : l)}
            active={activeLevel === l}
            small
          >
            {t(`level.${l}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  small = false,
  children,
}: {
  href: Record<string, string>;
  active: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={{ pathname: '/courses', query: href }}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-full border transition-colors',
        small ? 'px-3 py-1 text-[11px]' : 'px-4 py-2 text-xs',
        active
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-line bg-white text-ink-muted hover:border-brand-300 hover:text-brand-600',
      )}
    >
      {children}
    </Link>
  );
}
