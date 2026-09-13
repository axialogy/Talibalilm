'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  key: string;
  /** Short name under the number. */
  label: string;
  /** The heading shown above the panel. */
  heading: string;
  lead?: string;
  /** Rendered on the server and handed over as a node. */
  panel: ReactNode;
  /** The question this step asks has been answered. */
  complete: boolean;
}

/**
 * Inscriptions & Paiements — one card, five steps.
 *
 * The steps used to be five URLs. Each answer navigated, so the page jumped,
 * the scroll position reset and going back meant leaving the module's page.
 * Now the card stays put and only its contents change.
 *
 * Which step may be shown is not this component's decision. The server marks
 * each step complete or not from the selection cookie, and the furthest
 * reachable step is the first unanswered one — so a student cannot click
 * through to payment with an empty basket, whatever this state says.
 *
 * The panels are Server Components handed over as nodes, not functions: the
 * prices in them are computed server-side and the browser is never asked to
 * total anything. Answering a step calls a Server Action, which re-renders
 * those nodes in place; `reachable` then moves, and the effect below moves the
 * card with it.
 */
export function CheckoutWizard({
  steps,
  labels,
}: {
  steps: WizardStep[];
  /** `step` is pre-formatted per index — "Étape 3 sur 5" cannot be built here. */
  labels: { next: string; back: string; nav: string; step: string[] };
}) {
  const firstOpen = steps.findIndex((s) => !s.complete);
  const reachable = firstOpen === -1 ? steps.length - 1 : firstOpen;

  const [step, setStep] = useState(reachable);
  const previousReachable = useRef(reachable);

  // A step was just answered on the server. Move on, rather than making the
  // student press Suivant for a question they have visibly finished.
  useEffect(() => {
    if (reachable === previousReachable.current) return;
    const grew = reachable > previousReachable.current;
    previousReachable.current = reachable;
    if (grew) setStep((current) => (reachable > current ? reachable : current));
  }, [reachable]);

  const active = Math.min(step, reachable);
  const current = steps[active];
  const isLast = active === steps.length - 1;

  // An empty step list is a programming error upstream, not something to
  // render half of.
  if (!current) return null;

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
      {/* The numbers. An ordered list so a screen reader reads "3 of 5"
          without needing the visual position. */}
      <nav aria-label={labels.nav} className="border-b border-line bg-surface/50 px-4 py-5 sm:px-6">
        <ol className="flex flex-wrap items-center justify-center gap-x-1 gap-y-3">
          {steps.map((s, index) => {
            const done = index < active && s.complete;
            const isCurrent = index === active;
            const enabled = index <= reachable;
            return (
              <li key={s.key} className="flex items-center">
                <button
                  type="button"
                  disabled={!enabled}
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => setStep(index)}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-2.5 py-1.5 text-start transition-colors',
                    enabled ? 'cursor-pointer hover:bg-white' : 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full font-display text-[12px] font-semibold transition-colors',
                      isCurrent && 'bg-gold-500 text-white',
                      done && 'bg-brand-500 text-white',
                      !isCurrent && !done && 'bg-white text-ink-muted ring-1 ring-line',
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      'hidden text-[12px] sm:block',
                      isCurrent ? 'font-medium text-ink' : 'text-ink-muted',
                    )}
                  >
                    {s.label}
                  </span>
                </button>
                {index < steps.length - 1 && (
                  <span aria-hidden="true" className="mx-1 h-px w-4 bg-line sm:w-6" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="p-5 sm:p-7">
        <p className="text-[11px] tracking-[0.1em] text-ink-muted uppercase">
          {labels.step[active]}
        </p>
        <h3 className="mt-1.5 font-display text-[19px] font-semibold text-ink sm:text-[22px]">
          {current.heading}
        </h3>
        {current.lead && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
            {current.lead}
          </p>
        )}

        {/*
          Every panel stays mounted and the inactive ones are hidden, so a
          half-typed coupon code is still there when the student steps back to
          look at the price again. `hidden` rather than unmounting also keeps
          the card from resizing to nothing between steps.
        */}
        <div className="mt-6">
          {steps.map((s, index) => (
            <div key={s.key} hidden={index !== active}>
              {s.panel}
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-5">
          <button
            type="button"
            onClick={() => setStep((c) => Math.max(0, c - 1))}
            disabled={active === 0}
            className="inline-flex items-center gap-2 text-[13px] text-ink-muted transition-colors hover:text-brand-600 disabled:pointer-events-none disabled:opacity-40"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {labels.back}
          </button>

          {!isLast && (
            <button
              type="button"
              onClick={() => setStep((c) => Math.min(steps.length - 1, c + 1))}
              disabled={!current.complete}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-gold-500 px-6 font-display text-xs font-semibold tracking-[0.12em] text-white uppercase transition-colors hover:bg-gold-600 disabled:pointer-events-none disabled:opacity-40"
            >
              {labels.next}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
