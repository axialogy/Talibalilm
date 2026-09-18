import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BackLink } from '@/components/admin/BackLink';
import { Tabs } from '@/components/ui/tabs';
import { AnnouncementSettings } from '@/components/admin/AnnouncementSettings';
import { EventsEditor } from '@/components/admin/EventsEditor';
import { ReviewsEditor } from '@/components/admin/ReviewsEditor';
import { MessagesInbox } from '@/components/admin/MessagesInbox';
import { requireStaff } from '@/lib/auth/guards';
import { requireLocale } from '@/i18n/routing';
import {
  getSiteSettings,
  listAllEvents,
  listAllReviews,
  listContactMessages,
} from '@/lib/data/site';

export const dynamic = 'force-dynamic';

/**
 * Everything about the site that is not the catalogue.
 *
 * One page with four tabs rather than four entries in the sidebar: the office
 * opens this to change a sentence at the top of the site or to read what
 * somebody wrote in, and neither deserves its own place in a navigation list
 * that already has eight.
 *
 * The drafts and the postbag are read through the ordinary client, so the
 * `is_staff()` policies decide what comes back — the guard above is the first
 * gate, not the only one.
 */
export default async function AdminSitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  requireLocale(locale);
  setRequestLocale(locale);

  await requireStaff();
  const t = await getTranslations('admin');

  const [settings, events, reviews, messages] = await Promise.all([
    getSiteSettings(),
    listAllEvents(),
    listAllReviews(),
    listContactMessages(),
  ]);

  const unhandled = messages.filter((m) => m.handledAt === null).length;

  return (
    <div>
      <BackLink href="/admin" label={t('navOverview')} />
      <h1 className="font-display text-2xl font-semibold text-ink">{t('siteTitle')}</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t('siteLead')}</p>

      <div className="mt-8">
        <Tabs
          tabs={[
            {
              key: 'announcement',
              label: t('tabAnnouncement'),
              content: <AnnouncementSettings settings={settings} />,
            },
            {
              key: 'events',
              label: t('tabEvents'),
              content: <EventsEditor events={events} locale={locale} />,
            },
            {
              key: 'reviews',
              label: t('tabReviews'),
              content: <ReviewsEditor reviews={reviews} />,
            },
            {
              key: 'messages',
              // The count is the reason to open this tab, so it is on the tab.
              label: unhandled > 0 ? `${t('tabMessages')} (${unhandled})` : t('tabMessages'),
              content: <MessagesInbox messages={messages} locale={locale} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
