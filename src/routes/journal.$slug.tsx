import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { MirrorText } from '@/components/MirrorText';

export const Route = createFileRoute('/journal/$slug')({
  component: PostPage,
});

function PostPage() {
  const { slug } = Route.useParams();
  const { t, locale } = useI18n();
  const { posts } = useGlowStore();

  const post = posts.find(p => p.slug === slug && p.published);

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="font-display text-4xl">404</h1>
        <p className="mt-3 text-muted-foreground">{t('journalEmpty')}</p>
        <Link
          to="/journal"
          className="mt-8 inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-6 py-3 text-sm text-white"
        >
          {t('journalBack')}
        </Link>
      </div>
    );
  }

  const others = posts.filter(p => p.published && p.id !== post.id).slice(0, 2);
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <article className="relative isolate overflow-hidden grain">
      <div className="glow-mesh-soft animate-drift" aria-hidden="true" />

      <div className="relative mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <Link
          to="/journal"
          className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5 flip-rtl" />
          {t('journalBack')}
        </Link>

        <header className="mt-10">
          <p className="eyebrow">{post.tag}</p>
          <h1 className="mt-3 font-display text-4xl leading-tight text-balance sm:text-5xl">
            {post.title}
          </h1>
          <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={post.createdAt}>{dateFmt.format(new Date(post.createdAt))}</time>
            <span className="h-1 w-1 rounded-full bg-charcoal/25" />
            <span>{t('journalRead', { n: post.readMinutes })}</span>
          </div>
        </header>

        {post.coverImage && (
          <div className="mt-10 overflow-hidden rounded-2xl bg-secondary">
            <img
              src={post.coverImage}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        )}

        {/* Paragraphs come from a plain-text body, split on blank lines. */}
        <div className="mt-10 space-y-5">
          {post.body
            .split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(Boolean)
            .map((paragraph, i) => (
              <p key={i} className="text-[17px] leading-[1.75] text-charcoal/80 text-pretty">
                {paragraph}
              </p>
            ))}
        </div>

        <p className="mt-14 border-t border-border pt-10 text-center font-display text-xl italic text-charcoal/50">
          <MirrorText>{t('brandLine6')}</MirrorText>
        </p>

        {others.length > 0 && (
          <section className="mt-14 border-t border-border pt-10">
            <h2 className="eyebrow mb-5">{t('journalAll')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {others.map(o => (
                <Link
                  key={o.id}
                  to="/journal/$slug"
                  params={{ slug: o.slug }}
                  className="rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <span className="eyebrow">{o.tag}</span>
                  <h3 className="mt-2 font-display text-lg leading-snug">{o.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
