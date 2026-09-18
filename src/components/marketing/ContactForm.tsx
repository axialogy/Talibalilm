'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Send } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { ActionForm } from '@/components/ui/action-form';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { sendContactMessage, type ContactState } from '@/app/actions/contact';

const EMPTY: ContactState = { ok: false };

/**
 * The form on the contact page.
 *
 * Nothing here decides anything: the action re-validates every field with the
 * same schema, rate-limits by address and stores the message before it tries
 * to e-mail anybody. This component's only job is to show what came back.
 *
 * On success the form is replaced by the confirmation rather than cleared —
 * an empty form after a send reads as "nothing happened", which is how people
 * end up sending the same message three times.
 */
export function ContactForm() {
  const t = useTranslations('contact');
  const [state, action] = useActionState(sendContactMessage, EMPTY);

  if (state.ok) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50/60 p-6"
      >
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
        <p className="text-[14px] leading-relaxed text-brand-800">{state.message}</p>
      </div>
    );
  }

  return (
    <ActionForm action={action} className="space-y-4">
      <Field label={t('name')} name="name" required error={state.fieldErrors?.name} />
      <Field
        label={t('email')}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <Field
        label={`${t('subject')} (${t('subjectOptional')})`}
        name="subject"
        error={state.fieldErrors?.subject}
      />

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('message')}</span>
        <textarea
          name="message"
          rows={6}
          required
          minLength={10}
          maxLength={4000}
          aria-invalid={state.fieldErrors?.message ? true : undefined}
          className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-brand-400"
        />
        {state.fieldErrors?.message && (
          <span role="alert" className="mt-1.5 block text-[12px] text-red-600">
            {state.fieldErrors.message}
          </span>
        )}
      </label>

      {/*
        The honeypot. Hidden from sight and from a screen reader, and left out
        of the tab order, so no person can reach it — anything that fills it in
        is a script, and the action refuses the post.
      */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.message && !state.ok && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.message}
        </p>
      )}

      <SubmitButton size="md" block={false}>
        <Send className="size-4" aria-hidden="true" />
        {t('send')}
      </SubmitButton>
    </ActionForm>
  );
}
