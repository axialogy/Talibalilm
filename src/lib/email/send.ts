import 'server-only';
import { lookup, resolveMx } from 'node:dns/promises';
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
  /**
   * The name on the certificate, when it is not the name we dial.
   *
   * This exists because `mail.talibalim.com` has no DNS record, so every send
   * died at the resolver with `getaddrinfo EBUSY` — a fault no retry and no
   * code could fix, because the host genuinely is not there. Connecting to the
   * mail server's IP ADDRESS instead works around a missing record entirely,
   * but a certificate is issued for a name, so `SMTP_HOST=91.121.51.179` alone
   * would fail the TLS check next.
   *
   * `SMTP_SERVERNAME` is the way out: dial the address, present and verify the
   * name. Certificate checking stays on — the point is to keep it, not to
   * switch it off, and `rejectUnauthorized: false` would trade a working mail
   * server for one anybody on the path could impersonate.
   */
  servername: string;
}

function config(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  // 465 is implicit TLS, which is what the host's "Secure SSL/TLS" settings
  // describe. 587 is the STARTTLS alternative if the provider prefers it.
  const port = Number(process.env.SMTP_PORT ?? 465);
  return {
    host,
    user,
    pass,
    port: Number.isFinite(port) ? port : 465,
    servername: process.env.SMTP_SERVERNAME?.trim() || host,
  };
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
    // SNI, and the name the certificate is checked against. Identical to `host`
    // unless SMTP_SERVERNAME says otherwise, so the ordinary case is unchanged.
    tls: { servername: smtp.servername },
    // A serverless function that waits forever on a mail server is a request
    // that never answers. Fail, log, and let the caller carry on.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    pool: false,
  });
  return transporter;
}

/**
 * What a failed handshake actually means, in words the office can act on.
 *
 * `getaddrinfo EBUSY mail.talibalim.com` is precise and tells a non-engineer
 * nothing. The sentence is our reading; the raw text is kept after it, because
 * when the two disagree the evidence wins — and the evidence is what identifies
 * the fault, every time.
 */
export function explainSmtp(error: unknown, host: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  // Nodemailer folds the resolver's code into the message on some paths, so the
  // text is searched as well as the property.
  const has = (needle: string) => code === needle || raw.includes(needle);

  // EBUSY is the surprising one: it is not "the name is taken", it is what the
  // platform's resolver returns when it cannot answer at all.
  if (has('ENOTFOUND') || has('EAI_AGAIN') || has('EBUSY') || raw.includes('getaddrinfo')) {
    return `le nom « ${host} » n’existe pas dans le DNS (ou n’a pas pu être résolu) — ${raw}`;
  }
  if (has('ECONNREFUSED')) return `${host} a refusé la connexion sur ce port — ${raw}`;
  if (has('ETIMEDOUT') || has('ESOCKET') || raw.includes('timeout') || raw.includes('aucune réponse'))
    return `${host} n’a pas répondu dans le délai — ${raw}`;
  if (has('EAUTH') || raw.includes('535') || raw.toLowerCase().includes('authentication'))
    return `${host} a refusé l’identifiant ou le mot de passe — ${raw}`;
  if (raw.includes('certificate') || raw.includes('altnames') || has('ERR_TLS_CERT_ALTNAME_INVALID'))
    return (
      `le certificat de ${host} ne correspond pas à ce nom — ` +
      `définissez SMTP_SERVERNAME sur le nom du certificat — ${raw}`
    );
  return raw;
}

export interface SmtpProbe {
  configured: boolean;
  ms: number;
  ok: boolean;
  error?: string;
}

/**
 * How long does the mail server take to answer at all?
 *
 * `verify()` opens the connection and authenticates but SENDS NOTHING, which
 * makes it safe on a diagnostics page and makes it exactly the operation that
 * hangs when a shared mail host is unwell. One number here is worth an
 * afternoon of theorising about where a slow sign-up spends its time.
 *
 * Two deliberate choices:
 *
 * It builds its OWN transporter rather than using the cached one. A probe that
 * poisoned the sending path — or was poisoned by it — would report on
 * something other than the thing being measured.
 *
 * And it races a hard timeout, because a page that diagnoses a hang must not
 * inherit it. Nodemailer's own timeouts would usually cover this; the race is
 * the belt to their braces.
 */
export async function smtpProbe(timeoutMs = 15_000): Promise<SmtpProbe> {
  const smtp = config();
  if (!smtp) return { configured: false, ms: 0, ok: false };

  const startedAt = Date.now();
  const probe = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    tls: { servername: smtp.servername },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    pool: false,
  });

  try {
    await Promise.race([
      probe.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`aucune réponse en ${timeoutMs} ms`)), timeoutMs),
      ),
    ]);
    return { configured: true, ms: Date.now() - startedAt, ok: true };
  } catch (cause) {
    return {
      configured: true,
      ms: Date.now() - startedAt,
      ok: false,
      error: explainSmtp(cause, smtp.host),
    };
  } finally {
    probe.close();
  }
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

// ---------------------------------------------------------------------------
// Which mail host actually answers?
// ---------------------------------------------------------------------------

export type SmtpOutcome = 'works' | 'dns' | 'refused' | 'timeout' | 'tls' | 'auth' | 'other';

export interface SmtpCandidate {
  host: string;
  port: number;
  /** Why this host is on the list, in one phrase. */
  source: string;
  outcome: SmtpOutcome;
  ms: number;
  detail: string;
}

/**
 * The hosts worth trying, derived rather than invented.
 *
 * Guessing a hostname and being wrong has cost this project days. So the list
 * is built from things that are already true: what is configured now, what the
 * domain's own MX records say, and the conventional names — each one checked
 * against DNS before a connection is attempted, so a name that does not exist
 * is reported in a millisecond instead of after a four-second timeout.
 *
 * The domain comes from `SMTP_USER` (`contact@example.org` → `example.org`),
 * not from a constant. There is no domain string in `src/` and this does not
 * add one.
 */
async function candidateHosts(smtp: SmtpConfig): Promise<{ host: string; source: string }[]> {
  const domain = smtp.user.split('@')[1]?.trim().toLowerCase() ?? '';
  const out: { host: string; source: string }[] = [{ host: smtp.host, source: 'configuré' }];

  if (domain) {
    // What the domain itself says its mail goes to. This is the one piece of
    // evidence that is neither a convention nor a guess.
    try {
      const mx = await resolveMx(domain);
      for (const record of mx.sort((a, b) => a.priority - b.priority).slice(0, 3)) {
        out.push({ host: record.exchange.replace(/\.$/, ''), source: `MX de ${domain}` });
      }
    } catch {
      // No MX, or the resolver is unhappy. The conventional names below still
      // get their turn; nothing here should be fatal.
    }

    for (const prefix of ['ssl0.ovh.net', `smtp.${domain}`, `mail.${domain}`, domain]) {
      out.push({
        host: prefix,
        source: prefix === 'ssl0.ovh.net' ? 'point d’envoi OVH standard' : 'nom conventionnel',
      });
    }
  }

  // First mention wins, so the configured host keeps its place at the top.
  const seen = new Set<string>();
  return out.filter(({ host }) => {
    const key = host.toLowerCase();
    if (!host || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Open, authenticate, send nothing, close. One candidate, one verdict. */
async function trySmtp(
  smtp: SmtpConfig,
  host: string,
  port: number,
  timeoutMs: number,
): Promise<{ outcome: SmtpOutcome; ms: number; detail: string }> {
  const startedAt = Date.now();

  // Resolved first, deliberately. A name that does not exist should cost a
  // millisecond and say so, not spend the whole budget looking like a slow
  // server. This is the exact failure the school is living with.
  try {
    await lookup(host);
  } catch (cause) {
    return {
      outcome: 'dns',
      ms: Date.now() - startedAt,
      detail: explainSmtp(cause, host),
    };
  }

  const probe = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    // The certificate is checked against the name we dialled, since these
    // candidates are names rather than addresses.
    tls: { servername: host },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    pool: false,
  });

  try {
    await Promise.race([
      probe.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`aucune réponse en ${timeoutMs} ms`)), timeoutMs),
      ),
    ]);
    return {
      outcome: 'works',
      ms: Date.now() - startedAt,
      detail: 'connexion et authentification réussies (aucun message envoyé)',
    };
  } catch (cause) {
    const detail = explainSmtp(cause, host);
    const outcome: SmtpOutcome = detail.includes('refusé la connexion')
      ? 'refused'
      : detail.includes('pas répondu')
        ? 'timeout'
        : detail.includes('identifiant')
          ? 'auth'
          : detail.includes('certificat')
            ? 'tls'
            : 'other';
    return { outcome, ms: Date.now() - startedAt, detail };
  } finally {
    probe.close();
  }
}

/**
 * Try every plausible mail host and report what each one did.
 *
 * The point is to stop guessing. `SMTP_HOST` names a host that does not resolve,
 * and the answer is not another theory about which name is right — it is a
 * button the school presses, after which the server states which host accepted
 * its credentials. That host goes into `SMTP_HOST` on Vercel and into
 * Supabase's own SMTP settings, which are pointed at the same dead name.
 *
 * Nothing is sent. `verify()` opens the connection and authenticates, which is
 * the whole question, and stops there.
 *
 * Sequential on purpose: five mail handshakes at once is exactly the burst that
 * made the diagnostics page cause the faults it was measuring.
 */
export async function smtpCandidates(timeoutMs = 3000): Promise<SmtpCandidate[]> {
  const smtp = config();
  if (!smtp) return [];

  const results: SmtpCandidate[] = [];
  for (const { host, source } of await candidateHosts(smtp)) {
    const primary = await trySmtp(smtp, host, smtp.port, timeoutMs);
    results.push({ host, port: smtp.port, source, ...primary });

    // A closed port is not a dead host: plenty of providers offer STARTTLS on
    // 587 and nothing on 465. Worth the second attempt, and only then.
    if ((primary.outcome === 'refused' || primary.outcome === 'timeout') && smtp.port !== 587) {
      const alt = await trySmtp(smtp, host, 587, timeoutMs);
      results.push({ host, port: 587, source: `${source} — STARTTLS`, ...alt });
    }
  }
  return results;
}
