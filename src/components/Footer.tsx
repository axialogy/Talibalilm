import { Link } from '@tanstack/react-router';
import { Instagram, Mail, Phone, MapPin } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { Logo } from '@/components/Logo';
import { MirrorText } from '@/components/MirrorText';

/** TikTok has no Lucide icon, so the glyph is inline. */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.69 5.69 0 0 0-.77-.05 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.29 1.38V7.3a4.28 4.28 0 0 1-3.23-1.48z" />
    </svg>
  );
}

export function Footer() {
  const { t } = useI18n();
  const { settings } = useGlowStore();
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 overflow-hidden border-t border-border bg-secondary/40">
      <div className="glow-mesh-soft animate-drift" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* The brand line, printed the way the garments are */}
        <div className="mb-14 text-center">
          <MirrorText className="font-display text-2xl italic text-charcoal/75 sm:text-3xl">
            {t('brandLine1')}
          </MirrorText>
        </div>

        <div className="grid gap-10 text-center sm:grid-cols-2 sm:text-start lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Logo brandName={settings.brandName} className="mx-auto sm:mx-0" />
            <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground sm:mx-0">
              {t('footerTagline')}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2 sm:justify-start">
              {settings.instagram && (
                <a
                  href={`https://instagram.com/${settings.instagram.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border bg-background p-2.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {settings.tiktok && (
                <a
                  href={`https://tiktok.com/@${settings.tiktok.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border bg-background p-2.5 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                  aria-label="TikTok"
                >
                  <TikTokIcon className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="eyebrow mb-4">{t('footerShop')}</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/shop" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('navShop')}
                </Link>
              </li>
              <li>
                <Link to="/drops" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('navDrops')}
                </Link>
              </li>
              <li>
                <Link to="/cart" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('navCart')}
                </Link>
              </li>
              <li>
                <Link to="/unlock" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('unlockTitle')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="eyebrow mb-4">{t('footerBrand')}</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/about" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('navAbout')}
                </Link>
              </li>
              <li>
                <Link to="/journal" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('navJournal')}
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground transition-colors hover:text-foreground">
                  {t('navContact')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="eyebrow mb-4">{t('footerHelp')}</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {settings.email && (
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center justify-center gap-2.5 transition-colors hover:text-foreground sm:justify-start"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="break-all">{settings.email}</span>
                  </a>
                </li>
              )}
              {settings.phone && (
                <li>
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, '')}`}
                    className="flex items-center justify-center gap-2.5 transition-colors hover:text-foreground sm:justify-start"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span dir="ltr">{settings.phone}</span>
                  </a>
                </li>
              )}
              {settings.address && (
                <li className="flex items-center justify-center gap-2.5 sm:justify-start">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {settings.address}
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* The brand is explicit that it is not a clinical service. */}
        <p className="mx-auto mt-14 max-w-3xl text-center text-xs leading-relaxed text-muted-foreground/80 sm:mx-0 sm:text-start">
          {t('footerDisclaimer')}
        </p>

        <div className="mt-6 border-t border-border pt-6 text-center text-xs text-muted-foreground sm:text-start">
          <p>
            © {year} {settings.brandName}. {t('footerRights')}
          </p>
          <p className="mt-1.5">
            {t('footerMadeBy')}{' '}
            <a
              href="https://axialogy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-charcoal/25 underline-offset-4 transition-colors hover:text-foreground hover:decoration-charcoal/60"
            >
              Axialogy
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
