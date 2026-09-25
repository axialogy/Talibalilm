import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { LiveSearch } from '@/components/admin/LiveSearch';
import { ConfirmStudentButton } from '@/components/admin/ConfirmStudentButton';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { listStudents } from '@/lib/data/admin';
import { requireLocale } from '@/i18n/routing';

/** Find a student by name or email, and see at a glance how much access they hold. */
export default async function AdminStudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const { q } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const students = await listStudents(q?.trim() || undefined);
  // The hour matters here: two registrations on the same day are told apart by
  // it when the office is looking for the one that just arrived.
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div>
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('studentsTitle')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {t('studentsLead')}
      </p>

      <LiveSearch
        action="/admin/students"
        defaultValue={q ?? ''}
        placeholder={t('searchStudents')}
        label={t('searchStudents')}
      />

      {students.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('studentsEmpty')}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[760px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface/60 text-left text-[11px] tracking-wide text-ink-muted uppercase">
                <th className="p-3 font-medium">{t('colName')}</th>
                <th className="p-3 font-medium">{t('colEmail')}</th>
                <th className="p-3 font-medium">{t('colEnrolledIn')}</th>
                <th className="p-3 font-medium">{t('colAccess')}</th>
                <th className="p-3 font-medium">{t('colJoined')}</th>
                <th className="p-3 font-medium">{t('colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.userId} className="transition-colors hover:bg-brand-50/40">
                  <td className="p-3">
                    <Link
                      href={`/admin/students/${s.userId}`}
                      className="font-medium text-ink hover:text-brand-600"
                    >
                      {s.fullName || '—'}
                    </Link>
                    {s.role !== 'student' && (
                      <Badge variant="soft" className="ml-2">
                        {s.role}
                      </Badge>
                    )}
                    {/* The reason to open this row: nobody has looked at this
                        registration yet. Drawn for students only — a staff
                        account is not a registration the office has to see. */}
                    {s.role === 'student' && s.reviewedAt === null && (
                      <Badge variant="warn" className="ml-2">
                        {t('studentPending')}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-ink-muted">{s.email ?? '—'}</td>
                  {/* What they are actually enrolled on. The column beside it
                      counts; this one says what, which is the question a
                      student list is normally opened to answer. */}
                  <td className="p-3">
                    {s.enrolledIn.length === 0 ? (
                      <span className="text-ink-muted">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {s.enrolledIn.slice(0, 3).map((name) => (
                          <Badge key={name} variant="soft">
                            {name}
                          </Badge>
                        ))}
                        {s.enrolledIn.length > 3 && (
                          <span className="text-[11px] text-ink-muted">
                            +{s.enrolledIn.length - 3}
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {s.activeEntitlements > 0 ? (
                      <Badge variant="success">{s.activeEntitlements}</Badge>
                    ) : (
                      <span className="text-ink-muted">0</span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap text-ink-muted">
                    {dateFmt.format(new Date(s.createdAt))}
                  </td>
                  {/* The registration action, where the office already is.
                      Confirming the e-mail also activates the account and
                      clears the Nouveau flag, so this one button is the whole
                      of the decision — and it is idempotent, which is why it
                      can sit on a row without reading auth.users first. */}
                  <td className="p-3 whitespace-nowrap">
                    {s.role === 'student' && s.approvedAt === null && !s.anonymisedAt ? (
                      <ConfirmStudentButton
                        userId={s.userId}
                        label={t('confirmCta')}
                        variant="outline"
                      />
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
