import { getTranslations } from 'next-intl/server';
import { Facebook, Instagram, Youtube } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/layout/Logo';
import { institut } from '@/lib/content/institut';
import { logoLockupSrc } from '@/lib/artwork';

/** TikTok has no Lucide icon, so the glyph is inline. */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.69 5.69 0 0 0-.77-.05 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.28 4.28 0 0 1-3.23-1.48z" />
    </svg>
  );
}

const SOCIALS = [
  { href: institut.social.facebook, label: 'Facebook', Icon: Facebook },
  { href: institut.social.instagram, label: 'Instagram', Icon: Instagram },
  { href: institut.social.tiktok, label: 'TikTok', Icon: TikTokIcon },
  { href: institut.social.youtube, label: 'YouTube', Icon: Youtube },
];

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const tNav = await getTranslations('nav');
  const tMeta = await getTranslations('meta');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-line bg-surface/60">
      <div className="shell py-16">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-10">
          <div>
            <Link href="/" aria-label={tMeta('siteName')}>
              <Logo className="h-20 w-auto sm:h-24" src={logoLockupSrc()} label={tMeta('siteName')} />
            </Link>
          </div>

          <div>
            <h2 className="font-display text-xl text-ink">{t('tagline')}</h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">{t('body')}</p>

            <nav aria-label={t('navTitle')} className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link href="/courses" className="text-ink-muted transition-colors hover:text-brand-600">
                {tNav('courses')}
              </Link>
              <Link href="/pricing" className="text-ink-muted transition-colors hover:text-brand-600">
                {tNav('pricing')}
              </Link>
              <Link href="/register" className="text-ink-muted transition-colors hover:text-brand-600">
                {tNav('register')}
              </Link>
              <Link href="/login" className="text-ink-muted transition-colors hover:text-brand-600">
                {tNav('login')}
              </Link>
            </nav>

            <nav aria-label={t('legalTitle')} className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <Link href="/legal/terms" className="text-ink-muted transition-colors hover:text-brand-600">
                {t('terms')}
              </Link>
              <Link href="/legal/privacy" className="text-ink-muted transition-colors hover:text-brand-600">
                {t('privacy')}
              </Link>
              <Link href="/legal/cookies" className="text-ink-muted transition-colors hover:text-brand-600">
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

            <ul className="mt-6 flex items-center gap-2">
              {SOCIALS.map(({ href, label, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex rounded-full border border-line bg-white p-2.5 text-ink-muted transition-colors hover:border-brand-300 hover:text-brand-600"
                  >
                    <Icon className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-14 border-t border-line pt-6 text-xs text-ink-muted">
          © {year} {tMeta('siteName')}. {t('rights')}
        </p>
      </div>
    </footer>
  );
}
