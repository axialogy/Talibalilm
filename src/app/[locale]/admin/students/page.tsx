import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Search } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { listStudents } from '@/lib/data/admin';

/** Find a student by name or email, and see at a glance how much access they hold. */
export default async function AdminStudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const students = await listStudents(q?.trim() || undefined);
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink">{t('studentsTitle')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t('studentsLead')}</p>

      <form className="mt-6 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder={t('searchStudents')}
            aria-label={t('searchStudents')}
            className="w-full rounded-full border border-line bg-white py-2.5 pr-4 pl-10 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
      </form>

      {students.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-8 text-center text-sm text-ink-muted">
          {t('studentsEmpty')}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-surface/60 text-left text-[11px] tracking-wide text-ink-muted uppercase">
                <th className="p-3 font-medium">{t('colName')}</th>
                <th className="p-3 font-medium">{t('colEmail')}</th>
                <th className="p-3 font-medium">{t('colAccess')}</th>
                <th className="p-3 font-medium">{t('colJoined')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.userId} className="transition-colors hover:bg-brand-50/40">
                  <td className="p-3">
                    <Link href={`/admin/students/${s.userId}`} className="font-medium text-ink hover:text-brand-600">
                      {s.fullName || '—'}
                    </Link>
                    {s.role !== 'student' && (
                      <Badge variant="soft" className="ml-2">
                        {s.role}
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-ink-muted">{s.email ?? '—'}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
