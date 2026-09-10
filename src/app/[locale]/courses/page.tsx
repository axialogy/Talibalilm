import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { CourseCard } from '@/components/marketing/CourseCard';
import { CourseFilters } from '@/components/marketing/CourseFilters';
import { PageHero } from '@/components/marketing/PageHero';
import { listCourses } from '@/lib/content/courses';
import type { CourseCategory, CourseLevel } from '@/lib/content/types';

/**
 * Filters live in the URL, not in component state, so a filtered catalogue is
 * a shareable link and stays server-rendered and indexable — which the spec
 * requires of every public page.
 */
interface SearchParams {
  category?: string;
  level?: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'courses' });
  return { title: t('title'), description: t('lead') };
}

const CATEGORIES: CourseCategory[] = ['aqida', 'fiqh', 'coran', 'hadith', 'tafsir', 'langue', 'histoire'];
const LEVELS: CourseLevel[] = ['all', 'beginner', 'intermediate', 'advanced'];

function asCategory(value: string | undefined): CourseCategory | null {
  return value && (CATEGORIES as string[]).includes(value) ? (value as CourseCategory) : null;
}

function asLevel(value: string | undefined): CourseLevel | null {
  return value && (LEVELS as string[]).includes(value) ? (value as CourseLevel) : null;
}

export default async function CoursesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('courses');
  const { category: rawCategory, level: rawLevel } = await searchParams;

  const category = asCategory(rawCategory);
  const level = asLevel(rawLevel);

  const all = listCourses();
  const results = all.filter(
    (c) => (!category || c.category === category) && (!level || c.level === level),
  );

  // Only offer a chip for a category the catalogue actually uses — a filter
  // that can only return nothing is worse than no filter.
  const used = new Set(all.map((c) => c.category));
  const categories = CATEGORIES.filter((c) => used.has(c));

  return (
    <>
      <PageHero crumb={t('title')} eyebrow={t('filterSubject')} title={t('title')} lead={t('lead')} />

      <section className="py-14 sm:py-16">
        <div className="shell">
          <CourseFilters
            categories={categories}
            levels={LEVELS}
            activeCategory={category}
            activeLevel={level}
          />

          <p className="mt-8 text-xs text-ink-muted" aria-live="polite">
            {t('resultCount', { count: results.length })}
          </p>

          {results.length > 0 ? (
            <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <p className="mt-10 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-10 text-center text-sm text-ink-muted">
              {t('empty')}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
