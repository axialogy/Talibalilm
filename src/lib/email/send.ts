import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Transactional e-mail, through the school's own mailbox.
 *
 * This used to go through Resend's HTTP API. The school has a mailbox on its
 * own domain — `contact@talibalim.com` on `mail.talibalim.com` — and using it
 * removes a third party, a second set of credentials, and a free-tier limit
 * that only ever caused confusion. It is also the SAME mailbox Supabase is
 * pointed at for the confirmation and password-reset messages, so the school
 * has one place to look when an e-mail does not arrive rather than two.
 *
 * Optional the same way PayPal is: with `SMTP_HOST` unset every send is a
 * logged no-op rather than a thrown error. A student still gets their access —
 * losing the receipt must never lose the sale — and the gap is visible in the
 * log for whoever is setting it up.
 *
 * The transporter is cached across invocations. A serverless container is
 * reused between requests, and rebuilding the TLS connection for every message
 * is the difference between a send that feels instant and one that does not.
 */

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Where a reply should go, when that is not the sender.
   *
   * The contact form needs it: the message leaves from the school's own
   * mailbox, and without this the office would hit reply and answer itself
   * instead of the visitor who wrote in.
   */
  replyTo?: string;
}

let transporter: Transporter | null = null;

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

function config(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  // 465 is implicit TLS, which is what the host's "Secure SSL/TLS" settings
  // describe. 587 is the STARTTLS alternative if the provider prefers it.
  const port = Number(process.env.SMTP_PORT ?? 465);
  return { host, user, pass, port: Number.isFinite(port) ? port : 465 };
}

export function emailConfigured(): boolean {
  return config() !== null;
}

/**
 * Where the school's own alerts land — a registration, a contact form.
 *
 * Deliberately NOT `institut.email`. That is the address printed on the
 * Contact page for students to write to; this is the mailbox the office
 * actually watches, which is the same one the site sends from. With the SMTP
 * variables set it needs no configuration of its own, and `OFFICE_EMAIL` is
 * there for the day the two want to differ.
 *
 * Falls back to the public address so an unconfigured install still addresses
 * its alerts to a real person rather than to nobody.
 */
export function officeInbox(fallback: string): string {
  return process.env.OFFICE_EMAIL?.trim() || process.env.SMTP_USER?.trim() || fallback;
}

/** Which mailbox the message comes from. Must be one the server may send as. */
function fromAddress(): string {
  return process.env.EMAIL_FROM ?? `Institut Talib Alim <${process.env.SMTP_USER ?? ''}>`;
}

function transport(smtp: SmtpConfig): Transporter {
  transporter ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // Implicit TLS on 465; STARTTLS on anything else. Getting this backwards is
    // the usual cause of a hang rather than an error, so it is derived from the
    // port rather than configured separately and got wrong.
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    // A serverless function that waits forever on a mail server is a request
    // that never answers. Fail, log, and let the caller carry on.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    pool: false,
  });
  return transporter;
}

/** Returns true when the mail server accepted the message, false otherwise. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const smtp = config();
  if (!smtp) {
    console.warn('[email] SMTP_HOST not set — would have sent:', mail.subject, 'to', mail.to);
    return false;
  }

  try {
    await transport(smtp).sendMail({
      from: fromAddress(),
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    });
    return true;
  } catch (cause) {
    // Never rethrown. Every caller treats a receipt or a notification as a
    // courtesy, and a courtesy that throws would turn a completed sale or a
    // stored enquiry into an error page.
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error('[email] send failed:', message, '—', mail.subject);
    // A failed connection may have left the cached transporter unusable; drop
    // it so the next send builds a fresh one instead of repeating the failure.
    transporter = null;
    return false;
  }
}
