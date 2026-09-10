import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/marketing/PageHero';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/env';
import { signOut } from '@/app/actions/auth';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Phase 1 stub.
 *
 * The middleware already refuses this route to a signed-out visitor; this
 * re-checks server-side anyway, because a middleware matcher is a routing
 * convenience and not an authorisation boundary. Phase 2 replaces the body
 * with the real learning surface.
 */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!supabaseConfigured) redirect('/login');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, locale')
    .eq('id', user.id)
    .single();

  const t = await getTranslations('nav');

  return (
    <>
      <PageHero
        crumb={t('dashboard')}
        title={profile?.full_name ? profile.full_name : t('dashboard')}
        lead={user.email ?? undefined}
      />

      <section className="py-14">
        <div className="shell max-w-2xl">
          <p className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-sm leading-relaxed text-ink-muted">
            Phase 1 : l’authentification fonctionne. Les cours, la progression, les classes en direct
            et l’abonnement arrivent aux phases suivantes.
          </p>

          <form action={signOut} className="mt-6">
            <Button type="submit" variant="outline">
              {t('logout')}
            </Button>
          </form>
        </div>
      </section>
    </>
  );
}
