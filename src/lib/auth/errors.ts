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
];

export function classifyAuthError(raw: string): AuthErrorKey {
  for (const [pattern, key] of PATTERNS) {
    if (pattern.test(raw)) return key;
  }
  return 'unexpected';
}
