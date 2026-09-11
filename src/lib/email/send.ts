import 'server-only';
import { Resend } from 'resend';

/**
 * Transactional email.
 *
 * Optional the same way PayPal is: if `RESEND_API_KEY` is unset the school has
 * not connected a mailer yet, and every send is a logged no-op rather than a
 * thrown error. A student still gets their access — losing the receipt must
 * never lose the sale. The gap is visible in the log for whoever set it up.
 *
 * The address must be on a domain verified in Resend, or Resend refuses it.
 * The default below is a placeholder; set `EMAIL_FROM` to the school's own.
 */

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let client: Resend | null = null;

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? 'Institut Talib Alim <onboarding@resend.dev>';
}

/** Returns true when the message was accepted by Resend, false otherwise. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const service = resend();
  if (!service) {
    console.warn('[email] RESEND_API_KEY not set — would have sent:', mail.subject, 'to', mail.to);
    return false;
  }

  const { error } = await service.emails.send({
    from: fromAddress(),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  if (error) {
    console.error('[email] send failed:', error.message, '—', mail.subject);
    return false;
  }
  return true;
}
