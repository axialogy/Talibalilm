'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CourseStep {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * The module page, in four steps.
 *
 * It was four tabs, which read as four unrelated screens: nothing said that a
 * module is finished only when all four are filled, and the save button lived
 * inside whichever form happened to be on screen. Now there is one way through
 * — Détails, Contenu, Tarif, Cursus — and one footer with Enregistrer and
 * Annuler, always in the same place.
 *
 * The panels stay mounted while hidden, so a half-typed field survives moving
 * between steps. Enregistrer submits the module's own form (step one) from
 * wherever the office is standing; if a required field is empty and the form is
 * hidden, the step switches back to it first, because a browser cannot show a
 * validation bubble over something it is not displaying.
 *
 * When the module is still a draft, saving asks the one question that matters:
 * keep it a draft, or publish it.
 */
export function CourseSteps({
  steps,
  formId,
  needsStatusChoice,
}: {
  steps: CourseStep[];
  /** The id of the form the footer saves — the module's own details. */
  formId: string;
  /** True while the module is a draft: saving then asks draft-or-publish. */
  needsStatusChoice: boolean;
}) {
  const t = useTranslations('admin');
  const [active, setActive] = useState(0);
  const [choosing, setChoosing] = useState(false);

  const save = (intent?: 'draft' | 'publish') => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    // A hidden required field cannot be reported on. Go back to the step that
    // owns the form, then let the browser say what is missing.
    if (!form.checkValidity()) {
      setActive(0);
      setChoosing(false);
      requestAnimationFrame(() => form.reportValidity());
      return;
    }

    if (intent) {
      let field = form.querySelector<HTMLInputElement>('input[name="intent"]');
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = 'intent';
        form.appendChild(field);
      }
      field.value = intent;
    }

    setChoosing(false);
    form.requestSubmit();
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white">
      <nav aria-label={t('stepsNav')} className="border-b border-line bg-surface/50 px-4 py-3 sm:px-6">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {steps.map((step, index) => {
            const done = index < active;
            const current = index === active;
            return (
              <li key={step.key} className="flex items-center">
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  aria-current={current ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-2.5 py-1.5 text-start transition-colors',
                    current ? 'bg-white' : 'hover:bg-white/70',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full font-display text-[12px] font-semibold',
                      current || done ? 'bg-brand-500 text-white' : 'bg-white text-ink-muted ring-1 ring-line',
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      'hidden text-[12px] sm:block',
                      current ? 'font-medium text-ink' : 'text-ink-muted',
                    )}
                  >
                    {step.label}
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

      <div className="p-5 sm:p-6">
        {steps.map((step, index) => (
          <div key={step.key} hidden={index !== active}>
            {step.content}
          </div>
        ))}
      </div>

      {/* One footer, in the same place on every step. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface/40 px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-[13px] text-ink-muted transition-colors hover:text-red-600"
        >
          {t('stepCancel')}
        </button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={active === 0}
            onClick={() => setActive((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {t('stepBack')}
          </Button>
          {active < steps.length - 1 && (
            <Button
              type="button"
              variant="subtle"
              size="sm"
              onClick={() => setActive((current) => Math.min(steps.length - 1, current + 1))}
            >
              {t('stepNext')}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="gold"
            onClick={() => (needsStatusChoice ? setChoosing(true) : save())}
          >
            {t('stepSave')}
          </Button>
        </div>
      </div>

      {choosing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('saveChoiceTitle')}
          className="fixed inset-0 z-70 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-lifted">
            <p className="font-display text-lg font-semibold text-ink">{t('saveChoiceTitle')}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{t('saveChoiceLead')}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="md" onClick={() => save('draft')}>
                {t('saveAsDraft')}
              </Button>
              <Button type="button" variant="gold" size="md" onClick={() => save('publish')}>
                {t('saveAsPublish')}
              </Button>
              <button
                type="button"
                onClick={() => setChoosing(false)}
                className="text-[13px] text-ink-muted transition-colors hover:text-ink"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
