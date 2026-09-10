import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useGlowStore, defaultSettings } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { PageHeader, Btn, Field, inputClass } from '@/components/admin/AdminUI';
import type { StoreSettings } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useI18n();
  const { settings, updateSettings } = useGlowStore();
  const [form, setForm] = useState<StoreSettings>(settings);

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    updateSettings(form);
    toast.success(t('settingsSaved'));
  }

  return (
    <>
      <PageHeader
        title={t('adminSettings')}
        actions={
          <Btn variant="ghost" type="button" onClick={() => setForm(defaultSettings)}>
            {t('cancel')}
          </Btn>
        }
      />

      <form onSubmit={save} className="max-w-2xl space-y-8">
        {/* Brand */}
        <fieldset className="rounded-2xl border border-border bg-card p-6">
          <legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settingsBrand')}
          </legend>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('settingsBrandName')} htmlFor="s-name">
                <input
                  id="s-name"
                  value={form.brandName}
                  onChange={e => set('brandName', e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={t('settingsCurrency')} htmlFor="s-currency">
                <input
                  id="s-currency"
                  value={form.currency}
                  onChange={e => set('currency', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label={t('settingsTagline')} htmlFor="s-tagline">
              <input
                id="s-tagline"
                value={form.tagline}
                onChange={e => set('tagline', e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field
              label={t('settingsBrandColor')}
              htmlFor="s-color"
              hint="Drives the accent used across the storefront."
            >
              <div className="flex items-center gap-3">
                <input
                  id="s-color"
                  type="color"
                  value={form.brandColor}
                  onChange={e => set('brandColor', e.target.value)}
                  className="h-11 w-16 shrink-0 cursor-pointer rounded-xl border border-border bg-background p-1"
                />
                <input
                  value={form.brandColor}
                  onChange={e => set('brandColor', e.target.value)}
                  dir="ltr"
                  className={cn(inputClass, 'font-mono uppercase')}
                />
              </div>
            </Field>

            <Field
              label={t('settingsAnnouncement')}
              htmlFor="s-announce"
              hint={t('settingsAnnouncementHint')}
            >
              <input
                id="s-announce"
                value={form.announcement}
                onChange={e => set('announcement', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </fieldset>

        {/* Contact */}
        <fieldset className="rounded-2xl border border-border bg-card p-6">
          <legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settingsContact')}
          </legend>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('settingsEmail')} htmlFor="s-email">
              <input
                id="s-email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t('settingsPhone')} htmlFor="s-phone">
              <input
                id="s-phone"
                dir="ltr"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t('settingsInstagram')} htmlFor="s-ig">
              <input
                id="s-ig"
                dir="ltr"
                value={form.instagram}
                onChange={e => set('instagram', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t('settingsTiktok')} htmlFor="s-tt">
              <input
                id="s-tt"
                dir="ltr"
                value={form.tiktok}
                onChange={e => set('tiktok', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t('settingsAddress')} htmlFor="s-addr" className="sm:col-span-2">
              <input
                id="s-addr"
                value={form.address}
                onChange={e => set('address', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </fieldset>

        {/* Delivery */}
        <fieldset className="rounded-2xl border border-border bg-card p-6">
          <legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settingsDelivery')}
          </legend>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('settingsDeliveryHome')} htmlFor="s-home">
              <input
                id="s-home"
                type="number"
                min={0}
                value={form.deliveryHome}
                onChange={e => set('deliveryHome', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label={t('settingsDeliveryDesk')} htmlFor="s-desk">
              <input
                id="s-desk"
                type="number"
                min={0}
                value={form.deliveryDesk}
                onChange={e => set('deliveryDesk', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label={t('settingsFreeOver')} htmlFor="s-free">
              <input
                id="s-free"
                type="number"
                min={0}
                value={form.freeDeliveryOver}
                onChange={e => set('freeDeliveryOver', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Btn type="submit">{t('save_')}</Btn>
        </div>
      </form>
    </>
  );
}
