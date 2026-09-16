import { getTranslations } from 'next-intl/server';
import {
  AlertCircle,
  Award,
  Check,
  Gift,
  GraduationCap,
  Layers,
  MapPin,
  Plus,
  Tag,
  Video,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { PendingSpinner } from '@/components/ui/pending-spinner';
import { Badge } from '@/components/ui/badge';
import { CheckoutWizard, type WizardStep } from '@/components/checkout/CheckoutWizard';
import { PaymentForms } from '@/components/checkout/PaymentForms';
import { CheckoutProfileForm } from '@/components/checkout/CheckoutProfileForm';
import {
  applyCoupon,
  chooseCursus,
  chooseCursusYear,
  chooseDelivery,
  toggleProduct,
} from '@/app/actions/checkout';
import { loadBasket } from '@/lib/commerce/basket';
import { formatPrice } from '@/lib/commerce/quote';
import {
  getProgramme,
  listCursus,
  listProducts,
  programmeByYear,
  type ProgrammeEntry,
} from '@/lib/data/commerce';
import { getStudentProfile, profileComplete } from '@/lib/data/profile';
import { getPayPalPublicConfig } from '@/lib/paypal/client';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';

/** Errors handed back by the PayPal return and cancel routes, in the URL. */
const RETURN_ERRORS: Record<string, string> = {
  cancelled: 'payCancelled',
  amount_mismatch: 'payMismatch',
  not_completed: 'payNotCompleted',
  not_found: 'payUnexpected',
  unexpected: 'payUnexpected',
  unavailable: 'payUnavailable',
  paypalRefused: 'payRefused',
};

const CARD =
  'relative rounded-[var(--radius-card)] border p-5 text-start transition-colors';
const CARD_ON = 'border-brand-400 bg-brand-50/60';
const CARD_OFF = 'border-line bg-white hover:border-brand-300';

/**
 * The whole enrolment, in one card.
 *
 * Everything that decides a number happens here, on the server: the catalogue
 * is read, the basket is priced by `priceSelection`, and only finished markup
 * crosses into the browser. The wizard around it moves between panels and
 * nothing else.
 *
 * It is one component rather than five pages so it can also be dropped under a
 * module's page — which is where a student who has just read what is taught
 * actually wants to enrol, rather than being sent to a separate shop.
 */
export async function CheckoutFlow({
  locale,
  returnError,
  moduleContext,
}: {
  locale: string;
  /** `?error=` from the PayPal return route. */
  returnError?: string;
  /**
   * Set when the card is rendered on a module's own page. The module is then
   * the subject rather than a choice: the "which cursus" and "which modules"
   * steps are dropped, and the mode step resolves this course into its product.
   * A selection left over from another module (or an earlier visit) is ignored
   * until that happens, so this page never shows somebody else's basket.
   */
  moduleContext?: { courseId: string; cursusId: string };
}) {
  const t = await getTranslations('checkout');

  const [{ selection, quote }, cursusList] = await Promise.all([loadBasket(), listCursus()]);

  const stale = moduleContext !== undefined && selection.courseId !== moduleContext.courseId;
  const kind = stale ? 'module' : selection.kind;
  const delivery = stale ? null : selection.delivery;
  const cursusId = stale ? moduleContext.cursusId : selection.cursusId;
  const priced = stale ? null : quote;

  const products = delivery ? await listProducts(delivery) : [];
  const isApprofondi = kind === 'approfondi';
  const chosen = new Set(stale ? [] : selection.productIds);

  const modules = products.filter((p) => p.kind === 'module');
  const years = products
    .filter((p) => p.kind === 'cursus' && p.cursusId === cursusId)
    .sort((a, b) => a.yearIndex - b.yearIndex);

  const programme =
    isApprofondi && cursusId && delivery
      ? programmeByYear(await getProgramme(cursusId, delivery))
      : new Map<number, ProgrammeEntry[]>();

  // Signing in is required to pay, because an entitlement has to belong to
  // somebody. The selection survives in its cookie across the round trip.
  let signedIn = false;
  if (supabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = user !== null;
  }

  // The student's enrolment details, asked once and required before payment.
  // Fetched here rather than in the panel so the wizard knows whether the step
  // is answered before it renders anything.
  const profile = signedIn ? await getStudentProfile() : null;
  const detailsComplete = profileComplete(profile);

  // Public config only — the client id, the currency and the environment. The
  // secret never leaves the server module it is read in.
  const paypal = await getPayPalPublicConfig();
  const errorKey = returnError ? RETURN_ERRORS[returnError] : undefined;

  const allSteps: WizardStep[] = [
    {
      key: 'cursus',
      label: t('steps.cursus'),
      heading: t('steps.cursus'),
      lead: t('cursusLead'),
      complete: kind !== null,
      panel:
        cursusList.length === 0 ? (
          <Empty>{t('cursusEmpty')}</Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {cursusList.map((option) => {
              const on = cursusId === option.id;
              const Icon = option.kind === 'approfondi' ? GraduationCap : Layers;
              return (
                <li key={option.id}>
                  <form action={chooseCursus} className="h-full">
                    <input type="hidden" name="kind" value={option.kind} />
                    <input type="hidden" name="cursusId" value={option.id} />
                    <button
                      type="submit"
                      aria-pressed={on}
                      className={`${CARD} flex h-full w-full flex-col items-start ${on ? CARD_ON : CARD_OFF}`}
                    >
                      <span
                        className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                        aria-hidden="true"
                      >
                        <Icon className="size-5" />
                      </span>
                      <span className="mt-4 font-display text-[16px] font-semibold text-ink">
                        {option.title}
                      </span>
                      <span className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                        {option.subtitle ||
                          (option.kind === 'approfondi'
                            ? t('cursusApprofondiBody')
                            : t('cursusModuleBody'))}
                      </span>
                      {/*
                        What the student leaves with. It is the clearest
                        difference between the two routes and the question the
                        office is asked most, so it belongs on the card where
                        the choice is made rather than three steps later.
                      */}
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                        <Award className="size-3.5" aria-hidden="true" />
                        {option.kind === 'approfondi'
                          ? t('certificationApprofondi')
                          : t('certificationModule')}
                      </span>
                      {option.yearCount > 1 && (
                        <span className="mt-2 text-[11px] text-brand-600">
                          {t('yearLabel', { year: option.yearCount })}
                        </span>
                      )}
                      <PendingSpinner className="absolute end-4 top-4 text-brand-600" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        ),
    },
    {
      key: 'mode',
      label: t('steps.mode'),
      heading: t('steps.mode'),
      lead: t('modeLead'),
      complete: delivery !== null,
      panel: (
        <ul className="grid gap-4 sm:grid-cols-2">
          {(
            [
              {
                value: 'presentiel',
                Icon: MapPin,
                name: t('modePresentiel'),
                body: t('modePresentielBody'),
              },
              { value: 'online', Icon: Video, name: t('modeOnline'), body: t('modeOnlineBody') },
            ] as const
          ).map(({ value, Icon, name, body }) => {
            const on = delivery === value;
            return (
              <li key={value}>
                <form action={chooseDelivery} className="h-full">
                  <input type="hidden" name="delivery" value={value} />
                  {/* On a module page the module itself travels with the
                      answer, so the action can resolve it without depending on
                      a previous click having written the cookie. */}
                  {moduleContext && (
                    <>
                      <input type="hidden" name="courseId" value={moduleContext.courseId} />
                      <input type="hidden" name="cursusId" value={moduleContext.cursusId} />
                      <input type="hidden" name="kind" value="module" />
                    </>
                  )}
                  <button
                    type="submit"
                    aria-pressed={on}
                    className={`${CARD} flex h-full w-full flex-col items-start ${on ? CARD_ON : CARD_OFF}`}
                  >
                    <span
                      className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"
                      aria-hidden="true"
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-4 font-display text-[16px] font-semibold text-ink">
                      {name}
                    </span>
                    <span className="mt-2 text-[13px] leading-relaxed text-ink-muted">{body}</span>
                    <PendingSpinner className="absolute end-4 top-4 text-brand-600" />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      key: 'modules',
      label: t('steps.modules'),
      heading: t('steps.modules'),
      lead: isApprofondi ? t('modulesLeadApprofondi') : t('modulesLeadModule'),
      complete: selection.productIds.length > 0,
      panel: !delivery ? (
        <Empty>{t('modulesEmpty')}</Empty>
      ) : isApprofondi ? (
        years.length === 0 ? (
          <Empty>{t('modulesEmpty')}</Empty>
        ) : (
          <ul className="space-y-4">
            {years.map((year) => (
              <li
                key={year.id}
                className="rounded-[var(--radius-card)] border border-line bg-white p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h4 className="font-display text-[16px] font-semibold text-ink">
                    {t('yearLabel', { year: year.yearIndex })}
                  </h4>
                  <p className="font-display text-xl font-semibold text-brand-600">
                    {formatPrice(year.priceCents, locale)}
                  </p>
                </div>

                <ul className="mt-4 space-y-1.5">
                  {(programme.get(year.yearIndex) ?? []).map((entry) => (
                    <li
                      key={entry.courseId}
                      className="flex items-start gap-2 text-[13px] text-ink-muted"
                    >
                      <Check
                        className="mt-0.5 size-3.5 shrink-0 text-brand-500"
                        aria-hidden="true"
                      />
                      <Link
                        href={`/courses/${entry.courseSlug}`}
                        className="transition-colors hover:text-brand-600"
                      >
                        {entry.courseTitle}
                      </Link>
                    </li>
                  ))}
                </ul>

                <form action={chooseCursusYear} className="mt-5">
                  <input type="hidden" name="productId" value={year.id} />
                  <SubmitButton
                    size="md"
                    variant={chosen.has(year.id) ? 'outline' : 'primary'}
                  >
                    {chosen.has(year.id) ? t('selected') : t('select')}
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )
      ) : modules.length === 0 ? (
        <Empty>{t('modulesEmpty')}</Empty>
      ) : (
        <>
          <ul className="space-y-2">
            {modules.map((product) => {
              const picked = chosen.has(product.id);
              return (
                <li key={product.id}>
                  <form action={toggleProduct}>
                    <input type="hidden" name="productId" value={product.id} />
                    <button
                      type="submit"
                      aria-pressed={picked}
                      className={`${CARD} flex w-full flex-wrap items-center gap-3 !py-3 ${
                        picked ? CARD_ON : CARD_OFF
                      }`}
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                          picked ? 'bg-brand-500 text-white' : 'bg-surface text-ink-muted'
                        }`}
                        aria-hidden="true"
                      >
                        {picked ? <Check className="size-4" /> : <Plus className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1 font-display text-[14px] font-semibold text-ink">
                        {product.title}
                      </span>
                      <span className="font-display text-[14px] font-semibold text-ink">
                        {formatPrice(product.priceCents, locale)}
                      </span>
                      <PendingSpinner className="text-brand-600" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          <p className="mt-4">
            <Badge variant="soft">{t('chosen', { count: chosen.size })}</Badge>
          </p>
        </>
      ),
    },
    {
      key: 'info',
      label: t('steps.info'),
      heading: t('infoHeading'),
      lead: t('infoLead'),
      complete: detailsComplete,
      panel: !signedIn ? (
        /* Accounts first, then details and payment — an entitlement has to
           belong to somebody, and the basket survives the round trip in its
           cookie. */
        <div className="rounded-[var(--radius-card)] border border-line bg-surface/50 p-5">
          <p className="text-[13px] text-ink-muted">{t('loginRequired')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild size="md">
              <Link href="/register?next=%2Fcheckout">{t('registerCta')}</Link>
            </Button>
            <Button asChild size="md" variant="outline">
              <Link href="/login?next=%2Fcheckout">{t('loginCta')}</Link>
            </Button>
          </div>
        </div>
      ) : (
        <CheckoutProfileForm profile={profile} email={profile?.email ?? null} />
      ),
    },
    {
      key: 'payment',
      label: t('steps.payment'),
      heading: t('payTitle'),
      lead: t('payLead'),
      complete: priced !== null && detailsComplete,
      panel: !priced ? (
        <Empty>{moduleContext && delivery ? t('moduleNotSoldInMode') : t('emptyBasket')}</Empty>
      ) : (
        <>
          {errorKey && (
            <p
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-[var(--radius-card)] border border-line bg-surface/60 p-4 text-[13px] leading-relaxed text-ink"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
              {t(errorKey)}
            </p>
          )}

          {/*
            What is being bought, on the same screen as the button that buys
            it. This used to be its own step — a "Récapitulatif" that asked the
            student to confirm a list before showing the payment, which is one
            screen more than the decision needs.
          */}
          <div className="rounded-[var(--radius-card)] border border-line">
            <ul className="divide-y divide-line">
              {priced.lines.map((line) => (
                <li key={line.productId} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[14px] font-semibold text-ink">{line.title}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {t('duration', { days: line.durationDays })}
                    </p>
                  </div>
                  {line.isFree ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-ink-muted line-through">
                        {formatPrice(line.listPriceCents, locale)}
                      </span>
                      <Badge variant="success">{t('offerFree')}</Badge>
                    </div>
                  ) : (
                    <span className="font-display text-[14px] font-semibold text-ink">
                      {formatPrice(line.unitPriceCents, locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {priced.pack && (
              <p className="flex items-center gap-2 border-t border-line bg-brand-50/60 px-4 py-3 text-[13px] text-brand-700">
                <Gift className="size-4 shrink-0" aria-hidden="true" />
                {t('offerApplied', { name: priced.pack.title })}
              </p>
            )}

            <dl className="space-y-2 border-t border-line p-4 text-[13px]">
              <div className="flex justify-between text-ink-muted">
                <dt>{t('subtotal')}</dt>
                <dd>{formatPrice(priced.subtotalCents, locale)}</dd>
              </div>
              {priced.discountCents > 0 && (
                <div className="flex justify-between text-brand-600">
                  <dt>{t('discount')}</dt>
                  <dd>−{formatPrice(priced.discountCents, locale)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 font-display text-lg font-semibold text-ink">
                <dt>{t('total')}</dt>
                <dd>{formatPrice(priced.totalCents, locale)}</dd>
              </div>
            </dl>
          </div>

          {/*
            The code is stored, and the total above is priced with it only when
            the database recognises it. Claiming it is still atomic and still
            happens when the order opens; this read is what lets the student
            see the discount before they commit, rather than discovering it on
            the receipt.
          */}
          <form
            action={applyCoupon}
            className="mt-5 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/40 p-4"
          >
            <label className="min-w-[200px] flex-1">
              <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <Tag className="size-3.5 text-ink-muted" aria-hidden="true" />
                {t('couponLabel')}
              </span>
              <input
                name="code"
                defaultValue={selection.couponCode ?? ''}
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-[var(--radius-input)] border border-line bg-white px-3 py-2.5 text-sm tracking-wide text-ink uppercase outline-none focus:border-brand-400"
              />
              <span className="mt-1.5 block text-[11px] text-ink-muted">{t('couponHint')}</span>
            </label>
            <SubmitButton variant="outline" size="md">
              {t('couponApply')}
            </SubmitButton>
          </form>

          {selection.couponCode && (
            <p
              role="status"
              className={
                priced.coupon ? 'mt-2 text-[12px] text-brand-600' : 'mt-2 text-[12px] text-red-600'
              }
            >
              {priced.coupon
                ? t('couponApplied', {
                    code: priced.coupon.code,
                    amount: formatPrice(priced.couponDiscountCents, locale),
                  })
                : t('codeRefused')}
            </p>
          )}

          <div className="mt-5">
            <PaymentForms paypal={paypal} free={priced.totalCents === 0} locale={locale} />
          </div>
        </>
      ),
    },
  ];

  // On a module's own page neither the cursus question nor the module list is
  // a question: the module is the subject. What remains is mode, details and
  // payment.
  const steps = moduleContext
    ? allSteps.filter((step) => step.key !== 'modules' && step.key !== 'cursus')
    : allSteps;

  return (
    <CheckoutWizard
      steps={steps}
      labels={{
        next: t('continue'),
        back: t('backStep'),
        nav: t('title'),
        step: steps.map((_, index) => t('step', { current: index + 1, total: steps.length })),
      }}
    />
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
      {children}
    </p>
  );
}
