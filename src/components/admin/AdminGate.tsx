import { getTranslations } from 'next-intl/server';
import { AlertTriangle, ShieldOff } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import type { Viewer } from '@/lib/auth/guards';

/**
 * What a non-staff visitor sees at /admin.
 *
 * Deliberately a page rather than a redirect. Bouncing someone to /dashboard
 * with no account of why is indistinguishable from the admin area being
 * broken — which is exactly how an afternoon gets spent checking environment
 * variables when the real answer was one SQL statement.
 *
 * Two different situations, and telling them apart is the point:
 *
 *   * No `profiles` row at all. The account predates the migrations, so the
 *     signup trigger never ran for it. Nothing about the role can be changed
 *     until that row exists, and no amount of promoting will help.
 *   * A row exists and says `student`. Ordinary: this person is not staff.
 *
 * The identifiers shown are the viewer's own, so this reveals nothing they
 * could not already read, and the SQL is useless without database access.
 */
export async function AdminGate({ viewer }: { viewer: Viewer }) {
  const t = await getTranslations('admin');
  const broken = viewer.profileMissing;

  const sql = broken
    ? `insert into public.profiles (id, full_name, role)\nvalues ('${viewer.id}', '${(viewer.fullName || viewer.email || '').replace(/'/g, "''")}', 'admin')\non conflict (id) do update set role = 'admin';`
    : `update public.profiles set role = 'admin'\nwhere id = '${viewer.id}';`;

  return (
    <div className="shell max-w-2xl py-16">
      <span
        className={`flex size-12 items-center justify-center rounded-full ${
          broken ? 'bg-gold-100 text-gold-700' : 'bg-surface text-ink-muted'
        }`}
        aria-hidden="true"
      >
        {broken ? <AlertTriangle className="size-6" /> : <ShieldOff className="size-6" />}
      </span>

      <h1 className="mt-5 font-display text-2xl font-semibold text-ink">
        {broken ? t('gateBrokenTitle') : t('gateStaffTitle')}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
        {broken ? t('gateBrokenBody') : t('gateStaffBody')}
      </p>

      <dl className="mt-6 grid gap-2 rounded-[var(--radius-card)] border border-line bg-white p-5 text-[13px] sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-ink-muted">{t('gateAccount')}</dt>
        <dd className="text-ink">{viewer.email ?? '—'}</dd>
        <dt className="text-ink-muted">{t('gateUserId')}</dt>
        <dd className="font-mono text-[12px] break-all text-ink">{viewer.id}</dd>
        <dt className="text-ink-muted">{t('gateProfileRow')}</dt>
        <dd className={broken ? 'font-medium text-gold-700' : 'text-ink'}>
          {broken ? t('gateProfileMissing') : t('gateProfilePresent')}
        </dd>
        <dt className="text-ink-muted">{t('gateRole')}</dt>
        <dd className="text-ink">{broken ? '—' : viewer.role}</dd>
      </dl>

      <h2 className="mt-8 font-display text-[15px] font-semibold text-ink">{t('gateHowTo')}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{t('gateHowToBody')}</p>
      <pre className="mt-3 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface/60 p-4 text-[12px] leading-relaxed text-ink">
        <code>{sql}</code>
      </pre>
      <p className="mt-2 text-[12px] text-ink-muted">{t('gateThenReload')}</p>

      <Button asChild variant="outline" size="md" className="mt-8">
        <Link href="/dashboard">{t('backToSite')}</Link>
      </Button>
    </div>
  );
}
