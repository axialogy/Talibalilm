import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('courses.detail');
  const tNav = await getTranslations('nav');

  return (
    <section className="hero-wash flex min-h-[60vh] items-center py-20">
      <div className="shell text-center">
        <p className="font-display text-6xl font-semibold text-brand-200">404</p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-ink">{t('notFoundTitle')}</h1>
        <p className="mt-3 text-sm text-ink-muted">{t('notFoundBody')}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link href="/courses">{t('notFoundCta')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">{tNav('home')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
