import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { Loader2, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import {
  requestPasswordReset, updatePassword, getCurrentUser, supabaseEnabled,
} from '@/lib/supabaseSync';
import { LogoMark } from '@/components/Logo';
import { PasswordField } from '@/components/admin/PasswordField';
import { MirrorText } from '@/components/MirrorText';

export const Route = createFileRoute('/admin/reset')({
  component: ResetPage,
});

const MIN_PASSWORD = 8;

/**
 * One route, two jobs, because Supabase's recovery link lands back here.
 *
 * Arriving normally shows the "email me a link" form. Arriving from the email
 * carries recovery tokens in the URL hash, which supabase-js exchanges for a
 * short-lived session before this renders — so if a session already exists,
 * the job is to collect a new password instead.
 */
function ResetPage() {
  const { t } = useI18n();
  const { login } = useGlowStore();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Decide which of the two jobs this visit is for. This is the intended use
  // of an effect — synchronising with an external system, here the auth
  // session supabase-js just built from the recovery tokens in the URL.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!supabaseEnabled()) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    void getCurrentUser().then(user => {
      if (cancelled) return;
      setRecovering(Boolean(user));
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    await requestPasswordReset(email);
    // Always the same outcome, so this cannot be used to probe for accounts.
    setSent(true);
    setBusy(false);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(t('passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setBusy(true);
    const { error: updateError } = await updatePassword(password);
    if (updateError) {
      setError(updateError);
      setBusy(false);
      return;
    }

    // The recovery session is a real session, so this lands them straight in.
    const user = await getCurrentUser();
    if (user) login({ name: user.email.split('@')[0], email: user.email, role: 'owner' });
    toast.success(t('passwordSaved'));
    void navigate({ to: '/admin' });
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 grain">
      <div className="glow-mesh animate-drift" aria-hidden="true" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark className="mx-auto h-14 w-14" />
          <h1 className="mt-6 font-display text-3xl">
            {recovering ? t('newPasswordTitle') : t('resetTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground text-pretty">
            {recovering ? t('newPasswordSubtitle') : t('resetSubtitle')}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-7 shadow-soft">
          {checking ? (
            <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </p>
          ) : recovering ? (
            <form onSubmit={e => void savePassword(e)}>
              <div className="space-y-4">
                <PasswordField
                  id="new-password"
                  label={t('newPassword')}
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <PasswordField
                  id="confirm-password"
                  label={t('confirmPassword')}
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="mt-4 text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-charcoal px-6 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('savePassword')}
              </button>
            </form>
          ) : sent ? (
            <div className="py-2 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <MailCheck className="h-5 w-5 text-charcoal/70" />
              </span>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground text-pretty">
                {t('resetSent')}
              </p>
            </div>
          ) : (
            <form onSubmit={e => void sendLink(e)}>
              <div>
                <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium">
                  {t('loginEmail')}
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  autoComplete="username"
                  dir="ltr"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-charcoal/40"
                />
              </div>

              <button
                type="submit"
                disabled={busy || !supabaseEnabled()}
                className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-charcoal px-6 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('resetSend')}
              </button>

              {!supabaseEnabled() && (
                <p className="mt-4 text-center text-xs text-destructive">
                  {t('loginNotConfigured')}
                </p>
              )}
            </form>
          )}

          <p className="mt-5 text-center">
            <Link
              to="/admin/login"
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t('resetBackToLogin')}
            </Link>
          </p>
        </div>

        <p className="mt-10 text-center font-display text-base italic text-charcoal/35">
          <MirrorText>{t('brandLine4')}</MirrorText>
        </p>
      </div>
    </div>
  );
}
