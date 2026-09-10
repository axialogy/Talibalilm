import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/journal/')({
  component: JournalPage,
});

function JournalPage() {
  const { t, locale } = useI18n();
  const { posts } = useGlowStore();
  const [tag, setTag] = useState<string>('all');

  const published = useMemo(() => posts.filter(p => p.published), [posts]);

  const tags = useMemo(
    () => Array.from(new Set(published.map(p => p.tag).filter(Boolean))),
    [published],
  );

  const visible = tag === 'all' ? published : published.filter(p => p.tag === tag);

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      <header className="relative isolate overflow-hidden border-b border-border grain">
        <div className="glow-mesh-soft animate-drift" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h1 className="font-display text-5xl sm:text-6xl">{t('journalTitle')}</h1>
          <p className="mt-4 max-w-lg text-muted-foreground text-pretty">{t('journalSubtitle')}</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {tags.length > 1 && (
          <div className="no-scrollbar -mx-1 mb-10 flex gap-1.5 overflow-x-auto px-1 py-1">
            {['all', ...tags].map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setTag(value)}
                aria-pressed={tag === value}
                className={cn(
                  'shrink-0 cursor-pointer rounded-full border px-4 py-2 text-sm transition-all duration-200',
                  tag === value
                    ? 'border-charcoal bg-charcoal text-white'
                    : 'border-border bg-background text-muted-foreground hover:border-charcoal/30 hover:text-foreground',
                )}
              >
                {value === 'all' ? t('journalAll') : value}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">{t('journalEmpty')}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visible.map(post => (
              <Link
                key={post.id}
                to="/journal/$slug"
                params={{ slug: post.slug }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft"
              >
                {post.coverImage && (
                  <div className="aspect-[16/9] overflow-hidden bg-secondary">
                    <img
                      src={post.coverImage}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-7">
                  <span className="eyebrow">{post.tag}</span>
                  <h2 className="mt-3 font-display text-2xl leading-snug">{post.title}</h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {post.excerpt}
                  </p>
                  <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{dateFmt.format(new Date(post.createdAt))}</span>
                    <span>{t('journalRead', { n: post.readMinutes })}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
