import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { PageHero } from '@/components/marketing/PageHero';
import { ContactForm } from '@/components/marketing/ContactForm';
import { SocialLinks } from '@/components/layout/SocialLinks';
import { getSiteSettings } from '@/lib/data/site';
import { institut } from '@/lib/content/institut';
import { requireLocale } from '@/i18n/routing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  requireLocale(locale);
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('title'), description: t('lead') };
}

/**
 * Where to find the school, and how to write to it.
 *
 * This replaces the Tarifs page. Prices moved onto each module's own page,
 * beside the enrolment card that charges them, which left a price list that
 * duplicated the catalogue and agreed with it only by accident. What the site
 * did not have was an address and a way to ask a question.
 *
 * The address and phone number come from `institut.ts` — an address is not
 * translated and does not change — while the social links come from
 * `site_settings`, so the office edits them once and the footer here agrees.
 */
export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  requireLocale(locale);
  setRequestLocale(locale);

  const t = await getTranslations('contact');
  const settings = await getSiteSettings();

  const details = [
    {
      key: 'address',
      Icon: MapPin,
      title: t('addressTitle'),
      body: (
        <address className="not-italic">
          {institut.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      ),
    },
    {
      key: 'phone',
      Icon: Phone,
      title: t('phoneTitle'),
      body: (
        <a
          href={`tel:${institut.phone.replace(/\s/g, '')}`}
          dir="ltr"
          className="transition-colors hover:text-brand-600"
        >
          {institut.phone}
        </a>
      ),
    },
    {
      key: 'email',
      Icon: Mail,
      title: t('emailTitle'),
      body: (
        <a
          href={`mailto:${institut.email}`}
          className="break-all transition-colors hover:text-brand-600"
        >
          {institut.email}
        </a>
      ),
    },
  ];

  return (
    <>
      <PageHero crumb={t('title')} title={t('title')} lead={t('lead')} />

      <section className="py-14 sm:py-16">
        <div className="shell grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <div>
            <ul className="space-y-7">
              {details.map(({ key, Icon, title, body }) => (
                <li key={key} className="flex gap-4">
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-600"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
                    <div className="mt-1 text-[14px] leading-relaxed text-ink-muted">{body}</div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Absent rather than empty when the office has set no links. */}
            <div className="mt-10">
              <h2 className="font-display text-[15px] font-semibold text-ink">
                {t('followTitle')}
              </h2>
              <SocialLinks values={settings.social} className="mt-4" size="lg" />
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
            <h2 className="font-display text-[19px] font-semibold text-ink">{t('formTitle')}</h2>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
