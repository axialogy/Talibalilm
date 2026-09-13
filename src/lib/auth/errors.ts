/**
 * Classifying what Supabase Auth just refused.
 *
 * Pure and exported so it can be tested exhaustively: Supabase returns prose,
 * the strings change between releases, and a mapping that silently stops
 * matching turns every specific message into the useless catch-all.
 *
 * The keys are message keys in the `authErrors` namespace.
 */
export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'emailTaken'
  | 'rateLimited'
  | 'expiredLink'
  | 'weakPassword'
  | 'signupsDisabled'
  | 'databaseError'
  | 'emailSendFailed'
  | 'emailInvalid'
  | 'serviceUnavailable'
  | 'unexpected';

/** Longest, most specific patterns first — several of these overlap. */
const PATTERNS: [RegExp, AuthErrorKey][] = [
  [/invalid login credentials/i, 'invalidCredentials'],
  [/email not confirmed|email address not confirmed/i, 'emailNotConfirmed'],
  [/already registered|already been registered|user already exists/i, 'emailTaken'],
  // "For security purposes, you can only request this after 51 seconds" is
  // Supabase's cooldown between emails. It reads nothing like "rate limit" but
  // means exactly that, and telling someone to try again in a few minutes is
  // the right answer.
  [
    /rate limit|too many|over_?(email|request)_?(send_?)?rate|for security purposes.*after \d+ seconds/i,
    'rateLimited',
  ],
  [/expired|invalid token|token has expired|otp_expired/i, 'expiredLink'],
  [/password should be|weak.?password|password.*at least/i, 'weakPassword'],
  [/signups? (are )?not allowed|signup_disabled|email signups are disabled/i, 'signupsDisabled'],
  // The one that actually bites on a fresh project: `handle_new_user` raised,
  // usually because the migrations were not applied or were applied partly.
  // Without its own branch it reads as a generic outage and nobody looks at
  // the trigger.
  [/database error|unexpected_failure|error saving new user/i, 'databaseError'],
  // The one that stops a school taking registrations without anybody
  // understanding why. Supabase's built-in mail sender allows a handful of
  // messages an hour on the free plan; past that every sign-up fails here, and
  // the message says nothing about email. It is not a code problem and no
  // amount of retrying fixes it — the project needs its own SMTP.
  [
    /error sending (confirmation|recovery|magic|invite)?\s*(e-?mail|link)|smtp|failed to send/i,
    'emailSendFailed',
  ],
  // Some addresses are refused outright by the provider, which reads to the
  // visitor as a broken site rather than a typo in their own address.
  [/invalid(_|\s)?email|email address.*invalid|unable to validate email/i, 'emailInvalid'],
  // LAST, so it cannot swallow any of the specific cases above.
  //
  // Nothing answered in time. supabase-js reports a network failure as "fetch
  // failed" or "Failed to fetch", and a gateway giving up on a slow upstream as
  // a 502/503/504 — none of which say anything about what was slow. Before this
  // branch they all fell to the catch-all, whose text tells somebody REGISTERING
  // that we "cannot sign you in": the wrong verb, and no hint that an operator
  // should go and look at a service.
  [
    /fetch failed|failed to fetch|network (error|request failed)|timeout|timed out|deadline exceeded|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|\b50[234]\b|bad gateway|gateway time-?out|service unavailable/i,
    'serviceUnavailable',
  ],
];

export function classifyAuthError(raw: string): AuthErrorKey {
  for (const [pattern, key] of PATTERNS) {
    if (pattern.test(raw)) return key;
  }
  return 'unexpected';
}
