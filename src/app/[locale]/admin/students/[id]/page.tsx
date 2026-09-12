import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { GrantForm } from '@/components/admin/GrantForm';
import { RevokeButton } from '@/components/admin/RevokeButton';
import { AnonymiseButton } from '@/components/admin/AnonymiseButton';
import { StudentAccount } from '@/components/admin/StudentAccount';
import { getStudent } from '@/lib/data/admin';
import { currentViewer } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

/**
 * One student: who they are, what access they hold, and the controls to open
 * or close it. Grant and revoke are admin-only — an instructor sees the record
 * but not the buttons, matching the RPC that would refuse them anyway.
 */
export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const [data, viewer] = await Promise.all([getStudent(id), currentViewer()]);
  if (!data) notFound();

  const isAdmin = viewer?.role === 'admin';
  const { student, account, entitlements } = data;
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  // Options for the grant form, read through the same staff-scoped client.
  let courses: { id: string; title: string }[] = [];
  let cursus: { id: string; title: string }[] = [];
  if (isAdmin) {
    const supabase = await createClient();
    const [{ data: c }, { data: cu }] = await Promise.all([
      supabase.from('courses').select('id, title').order('display_order'),
      supabase.from('cursus').select('id, title').order('display_order'),
    ]);
    courses = c ?? [];
    cursus = cu ?? [];
  }

  const statusLabel = (s: string, expiresAt: string) => {
    if (s === 'cancelled') return t('entCancelled');
    if (new Date(expiresAt).getTime() <= Date.now()) return t('entExpired');
    return t('entActive');
  };

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/students"
        className="inline-flex items-center gap-2 text-xs text-ink-muted transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t('backToStudents')}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {student.fullName || student.email || t('studentDetail')}
        </h1>
        {student.role !== 'student' && <Badge variant="soft">{student.role}</Badge>}
        {student.anonymisedAt && <Badge variant="muted">{t('anonymised')}</Badge>}
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        {student.anonymisedAt
          ? t('anonymisedOn', { date: dateFmt.format(new Date(student.anonymisedAt)) })
          : student.email}
      </p>

      {isAdmin && (
        <section className="mt-8">
          <h2 className="font-display text-[15px] font-semibold text-ink">{t('studentAccount')}</h2>
          <div className="mt-3">
            <StudentAccount
              userId={student.userId}
              fullName={student.fullName}
              phone={account.phone}
              locale={account.locale}
              hasOrders={account.hasOrders}
            />
          </div>
        </section>
      )}

      <h2 className="mt-8 font-display text-[15px] font-semibold text-ink">{t('entitlementsHeld')}</h2>
      {entitlements.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-6 text-center text-sm text-ink-muted">
          {t('entNone')}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {entitlements.map((e) => {
            const live = e.status === 'active' && new Date(e.expiresAt).getTime() > Date.now();
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{e.label}</p>
                  <p className="text-[11px] text-ink-muted">
                    {t('entUntil')} {dateFmt.format(new Date(e.expiresAt))}
                    {e.note && ` · ${e.note}`}
                  </p>
                </div>
                <Badge variant={live ? 'success' : e.status === 'cancelled' ? 'danger' : 'muted'}>
                  {statusLabel(e.status, e.expiresAt)}
                </Badge>
                {isAdmin && live && <RevokeButton entitlementId={e.id} />}
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin && (
        <section className="mt-10">
          <h2 className="font-display text-[15px] font-semibold text-ink">{t('grantTitle')}</h2>
          <p className="mt-1 text-[12px] text-ink-muted">{t('grantLead')}</p>
          <div className="mt-3">
            <GrantForm userId={student.userId} courses={courses} cursus={cursus} />
          </div>
        </section>
      )}

      {isAdmin && student.role === 'student' && !student.anonymisedAt && (
        <section className="mt-10 rounded-[var(--radius-card)] border border-red-200 bg-red-50/40 p-5">
          <h2 className="font-display text-[15px] font-semibold text-red-700">{t('dangerZone')}</h2>
          <p className="mt-1 max-w-prose text-[12px] text-ink-muted">{t('dangerZoneLead')}</p>
          <div className="mt-3">
            <AnonymiseButton userId={student.userId} />
          </div>
        </section>
      )}
    </div>
  );
}
