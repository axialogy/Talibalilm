import { useState } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { signIn, supabaseEnabled } from '@/lib/supabaseSync';
import { PasswordField } from '@/components/admin/PasswordField';
import { useI18n } from '@/i18n';
import { LogoMark } from '@/components/Logo';
import { MirrorText } from '@/components/MirrorText';

export const Route = createFileRoute('/admin/login')({
  component: LoginPage,
});

/**
 * Sign-in is now handled by Supabase Auth.
 *
 * The previous version compared an email and password held in the bundle,
 * which could only hide the dashboard: both the password and the database key
 * are shipped to every visitor. Now the credentials go to Supabase, which
 * returns a JWT that Postgres validates on every request — so the RLS policies
 * decide what can be written, not this component. Faking your way past this
 * form gets you a dashboard that cannot save anything.
 */

function LoginPage() {
  const { t } = useI18n();
  const { login } = useGlowStore();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { user, error: authError } = await signIn(email, password);

    if (!user) {
      // Supabase's own wording ("Invalid login credentials") is clearer than a
      // generic message, and distinguishes a wrong password from a backend
      // that is not configured at all.
      setError(authError ?? t('loginError'));
      setBusy(false);
      return;
    }

    login({ name: user.email.split('@')[0], email: user.email, role: 'owner' });
    void navigate({ to: '/admin' });
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 grain">
      <div className="glow-mesh animate-drift" aria-hidden="true" />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark className="mx-auto h-14 w-14" />
          <h1 className="mt-6 font-display text-3xl">{t('loginTitle')}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t('loginSubtitle')}</p>
        </div>

        <form
          onSubmit={e => void submit(e)}
          className="rounded-2xl border border-border bg-card p-7 shadow-soft"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                {t('loginEmail')}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                dir="ltr"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-charcoal/40"
              />
            </div>

            <PasswordField
              id="password"
              label={t('loginPassword')}
              value={password}
              onChange={setPassword}
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
            {t('loginCta')}
          </button>

          <p className="mt-5 text-center">
            <Link
              to="/admin/reset"
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t('forgotPassword')}
            </Link>
          </p>

          {!supabaseEnabled() && (
            <p className="mt-4 text-center text-xs text-destructive">{t('loginNotConfigured')}</p>
          )}
        </form>

        <p className="mt-10 text-center font-display text-base italic text-charcoal/35">
          <MirrorText>{t('brandLine2')}</MirrorText>
        </p>
      </div>
    </div>
  );
}
