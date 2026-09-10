import { createFileRoute } from '@tanstack/react-router';
import { useI18n } from '@/i18n';
import { MirrorToggle, MirrorText } from '@/components/MirrorText';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

/** The brand book palette, reproduced as the page's own swatch row. */
const PALETTE = [
  { name: 'Lavender', hex: '#b0a8be' },
  { name: 'Dusty Pink', hex: '#e0cdc9' },
  { name: 'Faded Blue', hex: '#bcc3d6' },
  { name: 'Warm Beige', hex: '#ddcfbb' },
  { name: 'Silver Grey', hex: '#b1b0ad' },
  { name: 'Charcoal', hex: '#1a1a1a' },
];

function AboutPage() {
  const { t } = useI18n();

  return (
    <>
      {/* Hero */}
      <header className="relative isolate overflow-hidden border-b border-border grain">
        <div className="glow-mesh animate-drift" aria-hidden="true" />
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
          <p className="eyebrow">{t('aboutTitle')}</p>
          <h1 className="mt-5 font-display text-[clamp(2.25rem,6vw,4rem)] leading-[1.05] text-balance">
            {t('aboutHeroLine')}
          </h1>
          <p className="mx-auto mt-7 max-w-xl leading-relaxed text-charcoal/70 text-pretty">
            {t('aboutIntro')}
          </p>
        </div>
      </header>

      {/* Three pillars */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            { title: t('aboutIdentityTitle'), body: t('aboutIdentityBody') },
            { title: t('aboutPersonaTitle'), body: t('aboutPersonaBody') },
            { title: t('aboutVisualTitle'), body: t('aboutVisualBody') },
          ].map(block => (
            <div key={block.title}>
              <span className="hair-rule mb-6 block" />
              <h2 className="font-display text-2xl">{block.title}</h2>
              <p className="mt-3.5 leading-relaxed text-muted-foreground text-pretty">
                {block.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* The mirror, stated plainly */}
      <section className="relative isolate overflow-hidden border-y border-border bg-secondary/50 grain">
        <div className="glow-mesh-soft animate-drift" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <p className="eyebrow">{t('mirrorSectionEyebrow')}</p>
          <h2 className="mt-3 font-display text-4xl text-balance sm:text-5xl">
            {t('mirrorSectionTitle')}
          </h2>
          <div className="mirror-surface mx-auto mt-12 rounded-3xl px-6 py-14 shadow-glow sm:px-12">
            <MirrorToggle
              text={t('brandLine5')}
              showLabel={t('mirrorToggleShow')}
              hideLabel={t('mirrorToggleHide')}
            />
          </div>
        </div>
      </section>

      {/* Palette */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <h2 className="font-display text-4xl sm:text-5xl">{t('aboutPaletteTitle')}</h2>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {PALETTE.map(c => (
            <div key={c.hex}>
              <div
                className="aspect-square rounded-2xl border border-charcoal/10"
                style={{ backgroundColor: c.hex }}
              />
              <p className="mt-3 text-sm font-medium">{c.name}</p>
              <p className="font-mono text-xs uppercase text-muted-foreground">{c.hex}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Copy lines */}
      <section className="border-t border-border bg-charcoal py-24 text-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <ul className="space-y-7 text-center">
            {(['brandLine2', 'brandLine3', 'brandLine4', 'brandLine5', 'brandLine6'] as const).map(
              key => (
                <li key={key} className="font-display text-2xl italic text-white/80 sm:text-3xl">
                  <MirrorText>{t(key)}</MirrorText>
                </li>
              ),
            )}
          </ul>
        </div>
      </section>

      {/* The honest disclaimer — the brand persona is explicit that it is
          a friend, never a therapist. */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-8">
          <p className="leading-relaxed text-muted-foreground text-pretty">
            {t('aboutNotClinical')}
          </p>
        </div>
      </section>
    </>
  );
}
