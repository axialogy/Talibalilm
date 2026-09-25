'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { useActionPending } from '@/components/ui/action-form';

/**
 * The button that saves, and says so.
 *
 * Written for two opposite complaints. A save that showed nothing while it was
 * in flight made people press again; and a "Enregistré" that was already on
 * screen before anything was saved, because the form's initial state was
 * `{ ok: true }` — which is why every form using this starts from
 * `{ ok: false }` and lets this component decide when to say it worked.
 *
 * The spinner comes from whichever form this sits in: `useFormStatus` for a
 * plain form, the ActionForm context for one whose action is dispatched by
 * hand. The confirmation appears only after a submit that STARTED here and
 * finished ok, then clears itself — so a form that mounts on a successful
 * state does not claim a save nobody made.
 */
export function SaveButton({
  state,
  label,
  savedLabel,
  icon,
  ...props
}: ButtonProps & {
  /** The action's state: `ok` is only trusted after a submit from this button. */
  state: { ok: boolean; error?: string };
  label: string;
  savedLabel?: string;
  icon?: ReactNode;
}) {
  const t = useTranslations('admin');
  const dispatched = useActionPending();
  const { pending } = useFormStatus();
  const busy = dispatched || pending;

  const [saved, setSaved] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    if (busy) {
      submitted.current = true;
      setSaved(false);
      return;
    }
    if (!submitted.current) return;
    submitted.current = false;
    if (!state.ok || state.error) return;

    setSaved(true);
    const id = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(id);
  }, [busy, state]);

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={busy} aria-busy={busy} {...props}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : saved ? <Check aria-hidden="true" /> : icon}
        {label}
      </Button>
      {saved && (
        <span role="status" className="text-[12px] text-brand-600">
          {savedLabel ?? t('saved')}
        </span>
      )}
    </span>
  );
}
