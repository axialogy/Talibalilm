'use server';

import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { institut } from '@/lib/content/institut';
import { sendMail } from '@/lib/email/send';
import { reportError } from '@/lib/observability/report';

/**
 * A message from a visitor.
 *
 * Stored first, e-mailed second, and in that order on purpose. A form that
 * only sends an e-mail loses the enquiry whenever the mail provider has a bad
 * afternoon — and nobody finds out, because the person who wrote it assumes
 * the school simply did not reply.
 *
 * The insert goes through the ordinary anon client. `contact_messages` grants
 * `anon` INSERT and no SELECT at all, so a stranger may write to the school
 * and can never read the postbag back; the lengths and the address shape are
 * check constraints, which run whatever the client sends.
 */

export interface ContactState {
  ok: boolean;
  /** A resolved sentence, already localised — not a key. */
  message?: string;
  fieldErrors?: Record<string, string>;
}

const schema = z.object({
  name: z.string().trim().min(2, 'validation.nameShort').max(120, 'validation.tooLong'),
  email: z.string().trim().email('validation.emailInvalid').max(200, 'validation.tooLong'),
  subject: z.string().trim().max(200, 'validation.tooLong').default(''),
  message: z.string().trim().min(10, 'validation.messageShort').max(4000, 'validation.tooLong'),
  // Not a field anybody can see. A robot filling in every input gives itself
  // away here, which costs a human nothing and catches the cheapest spam.
  website: z.string().max(0).optional().default(''),
});

export async function sendContactMessage(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const t = await getTranslations('contact');

  const parsed = schema.safeParse({
    name: formData.get('name') ?? '',
    email: formData.get('email') ?? '',
    subject: formData.get('subject') ?? '',
    message: formData.get('message') ?? '',
    website: formData.get('website') ?? '',
  });

  if (!parsed.success) {
    const tAll = await getTranslations();
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? 'form');
      if (fieldErrors[field]) continue;
      fieldErrors[field] = issue.message.includes('.') ? tAll(issue.message) : issue.message;
    }
    // The honeypot is invisible, so naming it would be meaningless. A robot
    // that tripped it gets the same generic refusal as a malformed post.
    if (fieldErrors.website) return { ok: false, message: t('failed') };
    return { ok: false, fieldErrors };
  }

  // Five an hour from one address. Generous for a person, useless for a script.
  const { ok: allowed } = await rateLimit(clientKey(await headers(), 'contact'), {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!allowed) return { ok: false, message: t('rateLimited') };

  if (!supabaseConfigured) return { ok: false, message: t('failed') };

  const { name, email, subject, message } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('contact_messages')
    .insert({ name, email, subject, body: message });

  if (error) {
    reportError('contact.insert', error);
    return { ok: false, message: t('failed') };
  }

  // The message is safe now. Everything below is a courtesy, and a courtesy
  // that throws must not turn a stored enquiry into an error page.
  try {
    await sendMail({
      to: institut.email,
      subject: `[Site] ${subject || t('noSubject')} — ${name}`,
      // `reply-to` is what makes this useful: the office hits reply and
      // reaches the visitor rather than the sending domain.
      replyTo: email,
      text: [`De : ${name} <${email}>`, subject ? `Objet : ${subject}` : '', '', message]
        .filter(Boolean)
        .join('\n'),
      html: `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p>${
        subject ? `<p>${escapeHtml(subject)}</p>` : ''
      }<hr><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });
  } catch (cause) {
    reportError('contact.notify', cause, { note: 'the message was stored; only the alert failed' });
  }

  return { ok: true, message: t('sent') };
}

/**
 * The visitor's own words go into an HTML e-mail, so they are escaped.
 *
 * Not a page, but a mail client renders this, and a name containing a tag
 * would otherwise arrive as markup in the school's inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
