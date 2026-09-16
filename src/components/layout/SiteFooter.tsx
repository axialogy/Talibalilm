import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/layout/Logo';
import { SocialLinks } from '@/components/layout/SocialLinks';
import { institut } from '@/lib/content/institut';
import { getSiteSettings } from '@/lib/data/site';
import { logoLockupSrc } from '@/lib/artwork';

/**
 * The footer, centred.
 *
 * It used to be three columns — logo, blurb, contact — which read as a page
 * inside a page and left the eye nowhere to land. Now it is one centred
 * column: the lockup large at the top, the school in a sentence, how to reach
 * it, then the menu laid out horizontally across the full width above the
 * rule, and the copyright under it. On a phone everything is already centred,
 * which is what a narrow footer wants.
 */
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
      <div className="shell py-16 text-center">
        <Link href="/" aria-label={tMeta('siteName')} className="inline-block">
          <Logo
            className="mx-auto h-24 w-auto sm:h-28"
            sizes="(max-width: 640px) 280px, 360px"
            src={logoLockupSrc()}
            label={tMeta('siteName')}
          />
        </Link>

        <h2 className="mt-6 font-display text-xl text-ink">{t('tagline')}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink-muted">
          {t('body')}
        </p>

        <dl className="mt-10 grid gap-8 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-ink">{t('address')}</dt>
            <dd className="mt-1 text-ink-muted">
              {institut.addressLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">{t('phone')}</dt>
            <dd className="mt-1">
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
            <dd className="mt-1">
              <a
                href={`mailto:${institut.email}`}
                className="break-all text-ink-muted transition-colors hover:text-brand-600"
              >
                {institut.email}
              </a>
            </dd>
          </div>
        </dl>

        <SocialLinks values={settings.social} className="mt-8 justify-center" />

        {/* The menu: horizontal, centred, full footer width, above the rule. */}
        <nav
          aria-label={t('navTitle')}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-line pt-8 text-sm"
        >
          <Link href="/courses" className="text-ink-muted transition-colors hover:text-brand-600">
            {tNav('courses')}
          </Link>
          <Link href="/contact" className="text-ink-muted transition-colors hover:text-brand-600">
            {tNav('contact')}
          </Link>
          <Link href="/register" className="text-ink-muted transition-colors hover:text-brand-600">
            {tNav('register')}
          </Link>
          <Link href="/login" className="text-ink-muted transition-colors hover:text-brand-600">
            {tNav('login')}
          </Link>
        </nav>

        <nav
          aria-label={t('legalTitle')}
          className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"
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

      <div className="border-t border-line">
        <div className="shell py-6 text-center text-xs text-ink-muted">
          © {year} {tMeta('siteName')}.{' '}
          <a
            href="https://axialogy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-brand-600"
          >
            {t('madeBy')}
          </a>{' '}
          (
          <a
            href="https://axialogy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-brand-600"
          >
            axialogy.com
          </a>
          )
        </div>
      </div>
    </footer>
  );
}
