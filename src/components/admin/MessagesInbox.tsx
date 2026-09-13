'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { setMessageHandled } from '@/app/actions/site';
import type { AdminState } from '@/app/actions/admin';
import type { ContactMessageView } from '@/lib/data/site';

const IDLE: AdminState = { ok: false };

/**
 * What visitors have written in.
 *
 * Read-only apart from the "handled" flag. There is no delete: a question that
 * has been answered is still a record of having been asked, and the office may
 * need to find it again — the flag moves it out of the way without losing it.
 *
 * Replying happens in a mail client, not here. Building a reply box would mean
 * sending on the school's behalf from a page, and the school already has an
 * inbox that does it better.
 */
export function MessagesInbox({
  messages,
  locale,
}: {
  messages: ContactMessageView[];
  locale: string;
}) {
  const t = useTranslations('admin');
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  if (messages.length === 0) {
    return (
      <p className="max-w-3xl rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
        {t('messagesEmpty')}
      </p>
    );
  }

  return (
    <ul className="max-w-3xl space-y-4">
      {messages.map((message) => (
        <li
          key={message.id}
          className="rounded-[var(--radius-card)] border border-line bg-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-[15px] font-semibold text-ink">{message.name}</p>
                {message.handledAt && <Badge variant="success">{t('messageHandled')}</Badge>}
              </div>
              <a
                href={`mailto:${message.email}`}
                className="text-[12px] break-all text-brand-600 hover:text-brand-700"
              >
                {message.email}
              </a>
            </div>
            <p className="shrink-0 text-[11px] text-ink-muted">
              {dateFmt.format(new Date(message.createdAt))}
            </p>
          </div>

          {message.subject && (
            <p className="mt-3 text-[13px] font-medium text-ink">{message.subject}</p>
          )}
          <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-muted">
            {message.body}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button asChild size="sm" variant="outline">
              <a
                href={`mailto:${message.email}?subject=${encodeURIComponent(
                  message.subject || t('siteTitle'),
                )}`}
              >
                <Mail className="size-3.5" aria-hidden="true" />
                {t('messageReply')}
              </a>
            </Button>
            <HandledButton id={message.id} handled={message.handledAt !== null} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function HandledButton({ id, handled }: { id: string; handled: boolean }) {
  const t = useTranslations('admin');
  const [, action] = useActionState(setMessageHandled, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="handled" value={handled ? 'no' : 'yes'} />
      <Button type="submit" size="sm" variant="ghost">
        {handled ? t('messageMarkPending') : t('messageMarkHandled')}
      </Button>
    </form>
  );
}
