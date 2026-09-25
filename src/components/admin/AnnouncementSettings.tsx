'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import { SaveButton } from '@/components/admin/SaveButton';
import { saveSiteSettings } from '@/app/actions/site';
import type { AdminState } from '@/app/actions/admin';
import type { SiteSettings } from '@/lib/data/site';
import { ActionError } from '@/components/admin/ActionError';
import { ActionForm } from '@/components/ui/action-form';

/** `ok` means "the save succeeded", so nothing has succeeded yet. */
const IDLE: AdminState = { ok: false };

/**
 * The strip at the top of every page, and the social links under every page.
 *
 * One form, because they are one row — and because the office thinks of both
 * as "the bits around the edge of the site" rather than as two settings.
 */
export function AnnouncementSettings({ settings }: { settings: SiteSettings }) {
  const t = useTranslations('admin');
  const [state, action] = useActionState(saveSiteSettings, IDLE);

  return (
    <ActionForm action={action} className="max-w-2xl space-y-6">
      <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">
            {t('announcementText')}
          </span>
          <textarea
            name="announcement_text"
            rows={2}
            maxLength={300}
            defaultValue={settings.announcementText}
            className="w-full rounded-[var(--radius-input)] border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-brand-400"
          />
        </label>

        <Field
          label={t('announcementHref')}
          name="announcement_href"
          defaultValue={settings.announcementHref}
          hint={t('announcementHrefHint')}
        />

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="announcement_enabled"
            defaultChecked={settings.announcementEnabled}
            className="size-4 rounded border-line text-brand-500 focus:ring-brand-400"
          />
          <span className="text-[13px] text-ink">{t('announcementEnabled')}</span>
        </label>
      </div>

      <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white p-5">
        <p className="text-[13px] font-medium text-ink">{t('socialTitle')}</p>
        <p className="text-[11px] leading-relaxed text-ink-muted">{t('socialHint')}</p>

        <Field label="Facebook" name="facebook" defaultValue={settings.social.facebook} />
        <Field label="Instagram" name="instagram" defaultValue={settings.social.instagram} />
        <Field label="TikTok" name="tiktok" defaultValue={settings.social.tiktok} />
        <Field label="YouTube" name="youtube" defaultValue={settings.social.youtube} />
        <Field
          label="WhatsApp"
          name="whatsapp"
          defaultValue={settings.social.whatsapp}
          hint={t('whatsappHint')}
        />
      </div>

      <ActionError state={state} />

      <SaveButton state={state} label={t('save')} size="md" />
    </ActionForm>
  );
}
