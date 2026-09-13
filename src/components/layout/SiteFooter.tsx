import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/layout/Logo';
import { SocialLinks } from '@/components/layout/SocialLinks';
import { institut } from '@/lib/content/institut';
import { getSiteSettings } from '@/lib/data/site';
import { logoLockupSrc } from '@/lib/artwork';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  // One source for the links, shared with the contact page: the office edits
  // them once, in Admin → Site.
  const settings = await getSiteSettings();
  const tNav = await getTranslations('nav');
  const tMeta = await getTranslations('meta');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-surface/60">
      <div className="shell py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <Link href="/" aria-label={tMeta('siteName')}>
              <Logo
                className="h-20 w-auto sm:h-24"
                sizes="(max-width: 640px) 240px, 300px"
                src={logoLockupSrc()}
                label={tMeta('siteName')}
              />
            </Link>
          </div>

          <div>
            <h2 className="font-display text-xl text-ink">{t('tagline')}</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">{t('body')}</p>

            <nav aria-label={t('navTitle')} className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link
                href="/courses"
                className="text-ink-muted transition-colors hover:text-brand-600"
              >
                {tNav('courses')}
              </Link>
              <Link
                href="/contact"
                className="text-ink-muted transition-colors hover:text-brand-600"
              >
                {tNav('contact')}
              </Link>
              <Link
                href="/register"
                className="text-ink-muted transition-colors hover:text-brand-600"
              >
                {tNav('register')}
              </Link>
              <Link href="/login" className="text-ink-muted transition-colors hover:text-brand-600">
                {tNav('login')}
              </Link>
            </nav>

            <nav
              aria-label={t('legalTitle')}
              className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs"
            >
              <Link
                href="/legal/terms"
                className="text-ink-muted transition-colors hover:text-brand-600"
              >
                {t('terms')}
              </Link>
              <Link
                href="/legal/privacy"
                className="text-ink-muted transition-colors hover:text-brand-600"
              >
                {t('privacy')}
              </Link>
              <Link
                href="/legal/cookies"
                className="text-ink-muted transition-colors hover:text-brand-600"
              >
                {t('cookies')}
              </Link>
            </nav>
          </div>

          <div>
            <h2 className="font-display text-xl text-ink">{t('contactTitle')}</h2>

            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-ink">{t('address')}</dt>
                <dd className="mt-0.5 text-ink-muted">
                  {institut.addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">{t('phone')}</dt>
                <dd className="mt-0.5">
                  <a
                    href={`tel:${institut.phone.replace(/\s/g, '')}`}
                    dir="ltr"
                    className="text-ink-muted transition-colors hover:text-brand-600"
                  >
                    {institut.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">{t('email')}</dt>
                <dd className="mt-0.5">
                  <a
                    href={`mailto:${institut.email}`}
                    className="break-all text-ink-muted transition-colors hover:text-brand-600"
                  >
                    {institut.email}
                  </a>
                </dd>
              </div>
            </dl>

            <SocialLinks values={settings.social} className="mt-6" />
          </div>
        </div>

        <p className="mt-14 border-t border-line pt-6 text-xs text-ink-muted">
          © {year} {tMeta('siteName')}. {t('rights')}
        </p>
      </div>
    </footer>
  );
}
