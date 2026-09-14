'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import type { CourseCategory } from '@/lib/content/types';
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
  activeCategory,
}: {
  categories: CourseCategory[];
  activeCategory: CourseCategory | null;
}) {
  const t = useTranslations('courses');
  const searchParams = useSearchParams();

  /** Build the query for the subject facet, preserving anything else present. */
  const queryWith = (key: 'category', value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    return Object.fromEntries(next.entries());
  };

  return (
    <div className="space-y-4">
      {/* Subject only. A level filter used to sit below this and was removed:
          the school teaches a module to whoever enrols, so it drew a
          distinction the catalogue does not make and split results for no
          gain. */}
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
