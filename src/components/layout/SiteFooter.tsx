import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/layout/Logo';
import { SocialLinks } from '@/components/layout/SocialLinks';
import { institut } from '@/lib/content/institut';
import { getSiteSettings } from '@/lib/data/site';
import { logoLockupSrc } from '@/lib/artwork';

/**
 * The footer.
 *
 * Three columns on a desk — the lockup, the school in a sentence, how to
 * reach it — the way it has always been laid out. A centred stack made the
 * page end with a screen of empty space, so the shape came back; what stays
 * from the pass that followed is the horizontal menu across the full width
 * above the rule, and the centred copyright with the studio credit.
 *
 * On a phone the columns become one, and the whole footer centres — which is
 * what a narrow footer wants.
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
      <div className="shell py-12 sm:py-14">
        <div className="grid gap-10 text-center lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10 lg:text-start">
          <div>
            <Link href="/" aria-label={tMeta('siteName')} className="inline-block">
              <Logo
                className="mx-auto h-20 w-auto sm:h-24 lg:mx-0"
                sizes="(max-width: 640px) 240px, 300px"
                src={logoLockupSrc()}
                label={tMeta('siteName')}
              />
            </Link>
          </div>

          <div>
            <h2 className="font-display text-xl text-ink">{t('tagline')}</h2>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-ink-muted lg:mx-0">
              {t('body')}
            </p>
            <SocialLinks values={settings.social} className="mt-6 justify-center lg:justify-start" />
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
          </div>
        </div>

        {/* The menu: horizontal, centred, full footer width, above the rule. */}
        <nav
          aria-label={t('navTitle')}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-line pt-7 text-sm"
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
          className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"
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
        <p className="shell py-5 text-center text-xs text-ink-muted">
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
        </p>
      </div>
    </footer>
  );
}
