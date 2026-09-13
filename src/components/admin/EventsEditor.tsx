'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { CalendarDays, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { SubmitButton } from '@/components/auth/SubmitButton';
import { deleteEvent, saveEvent, setEventStatus, uploadEventImage } from '@/app/actions/site';
import type { AdminState } from '@/app/actions/admin';
import type { EventView } from '@/lib/data/site';

/**
 * The state before anything has been submitted.
 *
 * `ok: false` rather than `ok: true`, because `ok` here means "the save
 * succeeded". Starting at true makes a freshly opened form claim it has just
 * been saved, and makes any effect watching for success fire on mount.
 */
const IDLE: AdminState = { ok: false };

/**
 * Actualités & événements, from the office's side.
 *
 * A new item and an existing one use the same form and the same action; the
 * only difference is a hidden id. Publishing is a separate button from saving,
 * so nobody puts an unfinished announcement on the home page by pressing
 * Enter — draft is the default and the section stays absent until something is
 * deliberately published.
 */
export function EventsEditor({ events, locale }: { events: EventView[]; locale: string }) {
  const t = useTranslations('admin');
  const [adding, setAdding] = useState(false);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="max-w-3xl space-y-6">
      {!adding && (
        <Button type="button" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t('eventNew')}
        </Button>
      )}

      {adding && <EventForm onDone={() => setAdding(false)} />}

      {events.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('eventsEmpty')}
        </p>
      ) : (
        <ul className="space-y-4">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-[var(--radius-card)] border border-line bg-white p-5"
            >
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative aspect-[3/2] w-28 shrink-0 overflow-hidden rounded-[var(--radius-input)] border border-line bg-surface">
                  {event.imageUrl ? (
                    <Image
                      src={event.imageUrl}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : (
                    <span
                      className="flex size-full items-center justify-center text-ink-muted/40"
                      aria-hidden="true"
                    >
                      <CalendarDays className="size-5" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-[15px] font-semibold text-ink">{event.title}</p>
                    <Badge variant={event.status === 'published' ? 'success' : 'muted'}>
                      {event.status === 'published' ? t('publish') : t('statusDraft')}
                    </Badge>
                  </div>
                  {event.startsAt && (
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {dateFmt.format(new Date(event.startsAt))}
                    </p>
                  )}
                  {event.excerpt && (
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                      {event.excerpt}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <StatusButton id={event.id} published={event.status === 'published'} />
                <ImageButton id={event.id} />
                <DeleteButton id={event.id} />
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] text-brand-600">{t('edit')}</summary>
                <div className="mt-3">
                  <EventForm event={event} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, not an ISO string. */
function forInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EventForm({ event, onDone }: { event?: EventView; onDone?: () => void }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(saveEvent, IDLE);

  // Closing the form is a parent's state change, so it belongs in an effect.
  // Called during render it would fire on mount and update another component
  // mid-render, which React refuses.
  useEffect(() => {
    if (state.ok && onDone) onDone();
  }, [state.ok, onDone]);

  return (
    <form
      action={action}
      className="space-y-3 rounded-[var(--radius-card)] border border-line bg-surface/40 p-5"
    >
      {event && <input type="hidden" name="id" value={event.id} />}

      <Field label={t('eventTitle')} name="title" defaultValue={event?.title ?? ''} required />
      <Field
        label={t('eventTitleAr')}
        name="title_ar"
        dir="rtl"
        defaultValue={event?.titleAr ?? ''}
      />

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('eventExcerpt')}</span>
        <textarea
          name="excerpt"
          rows={2}
          maxLength={500}
          defaultValue={event?.excerpt ?? ''}
          className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink">{t('eventBody')}</span>
        <textarea
          name="body"
          rows={4}
          defaultValue={event?.body ?? ''}
          className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none focus:border-brand-400"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t('eventStartsAt')}
          name="starts_at"
          type="datetime-local"
          defaultValue={forInput(event?.startsAt ?? null)}
        />
        <Field label={t('eventLocation')} name="location" defaultValue={event?.location ?? ''} />
        <Field label={t('eventHref')} name="href" defaultValue={event?.href ?? ''} />
        <Field
          label={t('displayOrder')}
          name="display_order"
          type="number"
          min={0}
          defaultValue={event?.displayOrder ?? 0}
        />
      </div>

      {state.error && (
        <p role="alert" className="text-[12px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton size="sm" block={false}>
          {event ? t('save') : t('add')}
        </SubmitButton>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            {t('cancel')}
          </Button>
        )}
      </div>
    </form>
  );
}

function StatusButton({ id, published }: { id: string; published: boolean }) {
  const t = useTranslations('admin');
  const [, action] = useActionState(setEventStatus, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={published ? 'draft' : 'published'} />
      <Button type="submit" size="sm" variant={published ? 'outline' : 'primary'}>
        {published ? t('unpublish') : t('publish')}
      </Button>
    </form>
  );
}

function ImageButton({ id }: { id: string }) {
  const t = useTranslations('admin');
  const [state, action, pending] = useActionState(uploadEventImage, IDLE);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          if (e.currentTarget.files?.length) e.currentTarget.form?.requestSubmit();
        }}
        className="sr-only"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" aria-hidden="true" />
        {pending ? t('coverUploading') : t('eventImage')}
      </Button>
      {state.error && (
        <span role="alert" className="ms-2 text-[11px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </span>
      )}
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const t = useTranslations('admin');
  const [, action] = useActionState(deleteEvent, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t('confirmDeleteSimple'))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="ghost">
        <Trash2 className="size-3.5" aria-hidden="true" />
        {t('delete')}
      </Button>
    </form>
  );
}
