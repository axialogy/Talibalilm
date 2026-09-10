import { useState, useEffect, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { QrCode, ArrowRight, Loader2 } from 'lucide-react';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { MirrorText } from '@/components/MirrorText';
import { youtubeId, youtubeEmbedUrl } from '@/lib/youtube';
import type { UnlockContent } from '@/types';

export const Route = createFileRoute('/unlock')({
  // A scanned QR lands here as /#/unlock?code=SOFT-01
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === 'string' ? search.code : undefined,
  }),
  component: UnlockPage,
});

function UnlockPage() {
  const { code: codeFromQr } = Route.useSearch();
  const { t } = useI18n();
  const { redeemUnlock } = useGlowStore();

  const [input, setInput] = useState(codeFromQr ?? '');
  const [result, setResult] = useState<UnlockContent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const videoId = youtubeId(result?.linkUrl);

  const lookup = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setBusy(true);
      setNotFound(false);
      const found = await redeemUnlock(code);
      setResult(found);
      setNotFound(!found);
      setBusy(false);
    },
    [redeemUnlock],
  );

  // A code in the URL resolves on arrival — a scan should need no extra tap.
  // This is the intended use of an effect: synchronising component state with
  // an external system (here, the URL a QR code pointed at).
  //
  // Keyed on the URL code alone on purpose. Adding `lookup` to the deps would
  // re-run on every identity change and count the same scan repeatedly.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (codeFromQr) void lookup(codeFromQr);
  }, [codeFromQr]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  return (
    <div className="relative isolate min-h-[75vh] overflow-hidden grain">
      <div className="glow-mesh animate-drift" aria-hidden="true" />

      <div className="relative mx-auto max-w-xl px-4 py-20 sm:px-6 sm:py-28">
        {result ? (
          <div className="animate-scale-in text-center">
            <p className="eyebrow">
              {t('unlockFoundOn')} · {result.productName}
            </p>

            <div className="mirror-surface mt-8 rounded-3xl px-6 py-14 shadow-glow sm:px-10">
              <p className="font-display text-3xl italic leading-tight sm:text-4xl">
                <MirrorText reversed={false}>{result.message}</MirrorText>
              </p>
            </div>

            {result.body && (
              <p className="mx-auto mt-9 max-w-md leading-relaxed text-charcoal/70 text-pretty">
                {result.body}
              </p>
            )}

            {/* A YouTube link plays here rather than sending the visitor away
                — the code is on a garment label, so the phone is already in
                their hand. Anything else stays a plain button. */}
            {videoId ? (
              <div className="mt-9 overflow-hidden rounded-2xl border border-border bg-charcoal shadow-lifted">
                <div className="relative aspect-video">
                  <iframe
                    src={youtubeEmbedUrl(videoId)}
                    title={result.linkLabel ?? result.productName}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
              </div>
            ) : (
              result.linkUrl && (
                <a
                  href={result.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-9 inline-flex cursor-pointer items-center gap-2 rounded-full bg-charcoal px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted"
                >
                  {result.linkLabel ?? result.linkUrl}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 flip-rtl" />
                </a>
              )
            )}

            {videoId && result.linkLabel && (
              <p className="mt-4 text-sm text-muted-foreground">{result.linkLabel}</p>
            )}

            <p className="mt-10 text-xs text-muted-foreground">
              {t('unlockScans', { n: result.scans })}
            </p>

            <button
              type="button"
              onClick={() => {
                setResult(null);
                setInput('');
                setNotFound(false);
              }}
              className="mt-4 cursor-pointer text-sm underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t('unlockAnother')}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-charcoal">
              <QrCode className="h-7 w-7 text-white" />
            </span>

            <h1 className="mt-8 font-display text-4xl sm:text-5xl">{t('unlockTitle')}</h1>
            <p className="mx-auto mt-4 max-w-sm text-muted-foreground text-pretty">
              {t('unlockSubtitle')}
            </p>

            <form
              className="mx-auto mt-10 flex max-w-sm flex-col gap-3 sm:flex-row"
              onSubmit={e => {
                e.preventDefault();
                void lookup(input);
              }}
            >
              <label htmlFor="unlock-code" className="sr-only">
                {t('unlockCode')}
              </label>
              <input
                id="unlock-code"
                value={input}
                onChange={e => setInput(e.target.value.toUpperCase())}
                placeholder={t('unlockPlaceholder')}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                className="min-w-0 flex-1 rounded-full border border-border bg-background px-5 py-3.5 text-center font-mono text-sm tracking-widest outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-muted-foreground focus:border-charcoal/40"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-charcoal px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-charcoal-soft hover:shadow-lifted disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('unlockCta')}
              </button>
            </form>

            {notFound && (
              <p className="mt-6 text-sm text-destructive" role="alert">
                {t('unlockNotFound')}
              </p>
            )}

            <p className="mt-16 font-display text-lg italic text-charcoal/40">
              <MirrorText>{t('brandLine3')}</MirrorText>
            </p>

            <Link
              to="/shop"
              className="mt-8 inline-block text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {t('backToShop')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
