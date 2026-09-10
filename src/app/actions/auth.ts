'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured, siteUrl } from '@/lib/env';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import {
  forgotPasswordSchema,
  loginSchema,
  magicLinkSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/validation/auth';

/**
 * Auth server actions.
 *
 * Every one of these re-validates its input with the same Zod schema the form
 * used. The client-side pass is a courtesy; this is the one that counts.
 */
export interface ActionState {
  ok: boolean;
  /** A resolved sentence, already localised — not a key. */
  message?: string;
  /** Field-level errors keyed by field name, already localised. */
  fieldErrors?: Record<string, string>;
}

/** Resolve the schemas' message keys through next-intl. */
async function resolveFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Promise<Record<string, string>> {
  const t = await getTranslations();
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? 'form');
    if (out[field]) continue;
    // Schema messages are keys like `validation.emailInvalid`. Anything that
    // is not a dotted key falls through as-is rather than rendering blank.
    out[field] = issue.message.includes('.') ? t(issue.message) : issue.message;
  }
  return out;
}

async function notConfigured(): Promise<ActionState> {
  const t = await getTranslations('authErrors');
  return { ok: false, message: t('unexpected') };
}

/** Map Supabase's error strings onto our localised messages. */
async function authErrorMessage(raw: string): Promise<string> {
  const t = await getTranslations('authErrors');
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials')) return t('invalidCredentials');
  if (lower.includes('email not confirmed')) return t('emailNotConfirmed');
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return t('emailTaken');
  }
  if (lower.includes('rate limit') || lower.includes('too many')) return t('rateLimited');
  if (lower.includes('expired') || lower.includes('invalid token')) return t('expiredLink');
  return t('unexpected');
}

async function guard(scope: string, limit: number): Promise<ActionState | null> {
  const key = clientKey(await headers(), scope);
  const { ok } = rateLimit(key, { limit, windowMs: 15 * 60 * 1000 });
  if (ok) return null;
  const t = await getTranslations('authErrors');
  return { ok: false, message: t('rateLimited') };
}

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const limited = await guard('login', 10);
  if (limited) return limited;

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: await resolveFieldErrors(parsed.error.issues) };
  }
  if (!supabaseConfigured) return notConfigured();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, message: await authErrorMessage(error.message) };

  // Same-origin paths only, so `?next=` cannot become an open redirect.
  const next = parsed.data.next;
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  redirect(target);
}

export async function register(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const limited = await guard('register', 5);
  if (limited) return limited;

  const locale = await getLocale();
  const parsed = registerSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
    locale,
    acceptTerms: formData.get('acceptTerms') === 'on',
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: await resolveFieldErrors(parsed.error.issues) };
  }
  if (!supabaseConfigured) return notConfigured();

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the handle_new_user trigger. It is client-supplied, so the
      // trigger validates the locale and ignores everything else in here —
      // notably any `role` claim.
      data: { full_name: parsed.data.fullName, locale: parsed.data.locale },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent('/dashboard')}`,
    },
  });
  if (error) return { ok: false, message: await authErrorMessage(error.message) };

  redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function sendMagicLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const limited = await guard('magic', 5);
  if (limited) return limited;

  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { ok: false, fieldErrors: await resolveFieldErrors(parsed.error.issues) };
  }
  if (!supabaseConfigured) return notConfigured();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent('/dashboard')}`,
    },
  });
  if (error) return { ok: false, message: await authErrorMessage(error.message) };

  const t = await getTranslations('auth');
  return { ok: true, message: t('magicLinkSent') };
}

export async function forgotPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const limited = await guard('forgot', 5);
  if (limited) return limited;

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { ok: false, fieldErrors: await resolveFieldErrors(parsed.error.issues) };
  }

  const t = await getTranslations('auth');

  if (supabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
    });
  }

  // The same answer either way. Reporting "no such account" here would turn
  // the form into an account-enumeration oracle.
  return { ok: true, message: t('resetSent') };
}

export async function resetPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const limited = await guard('reset', 10);
  if (limited) return limited;

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: await resolveFieldErrors(parsed.error.issues) };
  }
  if (!supabaseConfigured) return notConfigured();

  const supabase = await createClient();
  // The recovery link already established a session in /auth/callback, so this
  // updates the signed-in user rather than trusting a token posted in a form.
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: await authErrorMessage(error.message) };

  redirect('/login?reset=1');
}

export async function signOut(): Promise<void> {
  if (supabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect('/');
}
