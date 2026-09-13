import 'server-only';
import type { Mail } from './send';

/**
 * The messages the school sends. Two languages, plain and legible, no images
 * to be blocked and no tracking pixels.
 *
 * Kept as one shared shell so every message from the institute looks like it
 * came from the same place. The copy lives here rather than in the next-intl
 * catalogues because it is server-only and never reaches the client bundle.
 */

interface Line {
  title: string;
  detail: string;
}

interface Shell {
  heading: string;
  intro: string;
  lines: Line[];
  outro: string;
}

const BRAND = '#128a68';
const INK = '#16221f';
const MUTED = '#5f736d';

function render(shell: Shell): string {
  const rows = shell.lines
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 0;border-top:1px solid #e5ebe9">
          <div style="font-weight:600;color:${INK}">${l.title}</div>
          <div style="color:${MUTED};font-size:14px">${l.detail}</div>
        </td>
      </tr>`,
    )
    .join('');

  return `<!doctype html><html><body style="margin:0;background:#f2f7f6;padding:24px;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5ebe9;border-radius:14px">
      <tr><td style="padding:28px 28px 8px">
        <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:${BRAND};font-weight:600">Institut Talib Alim</div>
        <h1 style="margin:12px 0 0;font-size:22px;color:${INK}">${shell.heading}</h1>
        <p style="color:${MUTED};line-height:1.6">${shell.intro}</p>
      </td></tr>
      <tr><td style="padding:0 28px">
        <table role="presentation" width="100%">${rows}</table>
      </td></tr>
      <tr><td style="padding:16px 28px 28px">
        <p style="color:${MUTED};font-size:14px;line-height:1.6">${shell.outro}</p>
      </td></tr>
    </table>
  </body></html>`;
}

function plain(shell: Shell): string {
  const lines = shell.lines.map((l) => `- ${l.title}: ${l.detail}`).join('\n');
  return `${shell.heading}\n\n${shell.intro}\n\n${lines}\n\n${shell.outro}\n\n— Institut Talib Alim`;
}

export interface OrderConfirmationData {
  to: string;
  locale: 'fr' | 'en';
  orderRef: string;
  items: { title: string; scheduleLabel: string; untilLabel: string }[];
  totalLabel: string;
}

export function orderConfirmation(data: OrderConfirmationData): Mail {
  const fr = data.locale === 'fr';
  const shell: Shell = {
    heading: fr ? 'Votre inscription est confirmée' : 'Your enrolment is confirmed',
    intro: fr
      ? 'Merci. Votre accès est ouvert ; vous le retrouvez à tout moment dans votre espace.'
      : 'Thank you. Your access is open; you can find it any time in your space.',
    lines: [
      ...data.items.map((i) => ({
        title: i.title + (i.scheduleLabel ? ` — ${i.scheduleLabel}` : ''),
        detail: fr ? `Accès jusqu’au ${i.untilLabel}` : `Access until ${i.untilLabel}`,
      })),
      {
        title: fr ? 'Total réglé' : 'Total paid',
        detail: data.totalLabel,
      },
    ],
    outro: fr
      ? `Commande n° ${data.orderRef}. Conservez cet e-mail comme justificatif. Pour toute question, répondez-y simplement.`
      : `Order no. ${data.orderRef}. Keep this email as your record. For any question, just reply to it.`,
  };
  return {
    to: data.to,
    subject: fr
      ? 'Inscription confirmée — Institut Talib Alim'
      : 'Enrolment confirmed — Institut Talib Alim',
    html: render(shell),
    text: plain(shell),
  };
}

export interface AccountApprovedData {
  to: string;
  locale: 'fr' | 'en';
  fullName: string;
  signInUrl: string;
}

/**
 * The message a student has been waiting for.
 *
 * Sent only when an account actually crosses from pending to approved —
 * `admin_set_approval` returns an address only on a real change, so pressing
 * the button twice cannot send this twice.
 */
export function accountApproved(data: AccountApprovedData): Mail {
  const fr = data.locale === 'fr';
  const name = data.fullName.trim();
  const shell: Shell = {
    heading: fr ? 'Votre compte est activé' : 'Your account is open',
    intro: fr
      ? `${name ? `${name}, v` : 'V'}otre inscription à l’Institut Talib Alim a été validée. Vous pouvez désormais vous connecter et choisir vos modules.`
      : `${name ? `${name}, y` : 'Y'}our registration at Institut Talib Alim has been approved. You can now sign in and choose your modules.`,
    lines: [
      {
        title: fr ? 'Se connecter' : 'Sign in',
        detail: data.signInUrl,
      },
    ],
    outro: fr
      ? 'Une question sur un module ou un cursus ? Répondez simplement à cet e-mail.'
      : 'A question about a module or a programme? Just reply to this email.',
  };
  return {
    to: data.to,
    subject: fr
      ? 'Votre compte est activé — Institut Talib Alim'
      : 'Your account is open — Institut Talib Alim',
    html: render(shell),
    text: plain(shell),
  };
}

export interface NewRegistrationData {
  to: string;
  fullName: string;
  email: string;
  reviewUrl: string;
}

/**
 * What the office is told when somebody registers.
 *
 * Always in French: this one goes to the school, not to a student, and the
 * school reads French. It carries the link to the person's page so approving
 * is one tap from the phone rather than a hunt through a list.
 */
export function newRegistration(data: NewRegistrationData): Mail {
  const shell: Shell = {
    heading: 'Nouvelle inscription à valider',
    intro:
      'Quelqu’un vient de créer un compte. Il reste en attente tant que vous ne l’avez pas validé.',
    lines: [
      { title: data.fullName || '—', detail: data.email },
      { title: 'Ouvrir la fiche', detail: data.reviewUrl },
    ],
    outro: 'Vous pouvez aussi valider depuis Administration → Étudiants.',
  };
  return {
    to: data.to,
    subject: `Nouvelle inscription : ${data.fullName || data.email}`,
    html: render(shell),
    text: plain(shell),
  };
}
