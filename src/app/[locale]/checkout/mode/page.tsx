import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapPin, Video } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { redirect } from '@/i18n/navigation';
import { CheckoutSteps } from '@/components/checkout/CheckoutSteps';
import { chooseDelivery } from '@/app/actions/checkout';
import { readSelection } from '@/lib/commerce/selection';

/**
 * Step 2 — on site or online.
 *
 * Not a cosmetic choice: the programme and the price differ, and so does the
 * entitlement, so this has to be settled before anything can be priced.
 */
export default async function ChooseModePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const selection = await readSelection();
  if (!selection.kind) redirect({ href: '/checkout', locale });


  const t = await getTranslations('checkout');

  const modes = [
    { value: 'presentiel', icon: MapPin, name: t('modePresentiel'), body: t('modePresentielBody') },
    { value: 'online', icon: Video, name: t('modeOnline'), body: t('modeOnlineBody') },
  ] as const;

  return (
    <>
      <CheckoutSteps current={2} />
      <h1 className="mt-6 font-display text-[clamp(1.5rem,3.4vw,2rem)] font-semibold text-ink">
        {t('steps.mode')}
      </h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-muted">{t('modeLead')}</p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {modes.map(({ value, icon: Icon, name, body }) => {
          const chosen = selection.delivery === value;
          return (
            <li key={value}>
              <form action={chooseDelivery} className="h-full">
                <input type="hidden" name="delivery" value={value} />
                <button
                  type="submit"
                  aria-pressed={chosen}
                  className={`flex h-full w-full flex-col items-start rounded-[var(--radius-card)] border p-6 text-start transition-colors ${
                    chosen
                      ? 'border-brand-400 bg-brand-50/60'
                      : 'border-line bg-white hover:border-brand-300'
                  }`}
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="mt-4 font-display text-[17px] font-semibold text-ink">
                    {name}
                  </span>
                  <span className="mt-2 text-[13px] leading-relaxed text-ink-muted">{body}</span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      <p className="mt-8">
        <Link
          href="/checkout"
          className="text-[13px] text-ink-muted transition-colors hover:text-brand-600"
        >
          {t('backStep')}
        </Link>
      </p>
    </>
  );
}
