import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Mail, Phone, MapPin, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';

export const Route = createFileRoute('/contact')({
  component: ContactPage,
});

function ContactPage() {
  const { t } = useI18n();
  const { settings } = useGlowStore();
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;

    // No mail backend in this build — the message opens in the visitor's own
    // client, addressed to the shop, so nothing is silently dropped.
    const subject = encodeURIComponent(`Grow & Glow — ${form.name.trim()}`);
    const body = encodeURIComponent(`${form.message.trim()}\n\n— ${form.name.trim()} (${form.email.trim()})`);
    window.location.href = `mailto:${settings.email}?subject=${subject}&body=${body}`;

    toast.success(t('contactSent'));
    setForm({ name: '', email: '', message: '' });
  }

  return (
    <div className="relative isolate overflow-hidden grain">
      <div className="glow-mesh-soft animate-drift" aria-hidden="true" />

      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <h1 className="font-display text-5xl sm:text-6xl">{t('contactTitle')}</h1>
        <p className="mt-4 max-w-lg text-muted-foreground text-pretty">{t('contactSubtitle')}</p>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_320px]">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="c-name" className="mb-1.5 block text-sm font-medium">
                  {t('contactName')}
                </label>
                <input
                  id="c-name"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-charcoal/40"
                />
              </div>
              <div>
                <label htmlFor="c-email" className="mb-1.5 block text-sm font-medium">
                  {t('contactEmail')}
                </label>
                <input
                  id="c-email"
                  type="email"
                  required
                  autoComplete="email"
                  dir="ltr"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-charcoal/40"
                />
              </div>
            </div>

            <div>
              <label htmlFor="c-message" className="mb-1.5 block text-sm font-medium">
                {t('contactMessage')}
              </label>
              <textarea
                id="c-message"
                required
                rows={7}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-charcoal/40"
              />
            </div>

            <button
              type="submit"
              className="cursor-pointer rounded-full bg-charcoal px-8 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
            >
              {t('contactSend')}
            </button>
          </form>

          <aside>
            <h2 className="eyebrow mb-5">{t('contactOrFollow')}</h2>
            <ul className="space-y-4 text-sm">
              {settings.email && (
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="break-all">{settings.email}</span>
                  </a>
                </li>
              )}
              {settings.phone && (
                <li>
                  <a
                    href={`tel:${settings.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Phone className="h-4 w-4 shrink-0" />
                    <span dir="ltr">{settings.phone}</span>
                  </a>
                </li>
              )}
              {settings.instagram && (
                <li>
                  <a
                    href={`https://instagram.com/${settings.instagram.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Instagram className="h-4 w-4 shrink-0" />@{settings.instagram.replace(/^@/, '')}
                  </a>
                </li>
              )}
              {settings.address && (
                <li className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  {settings.address}
                </li>
              )}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
