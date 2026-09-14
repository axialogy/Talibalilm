'use client';

import { useEffect } from 'react';

/**
 * What STAFF see when an admin page throws.
 *
 * The site-wide boundary shows a visitor a code and asks them to pass it on.
 * That is right for a student and wrong here: the person looking at this screen
 * is the person who has to fix it, and handing them a number with nowhere to
 * put it is the whole reason a broken module page cost a round. The engineering
 * notes already say it about actions — an admin screen shows the cause, never
 * only our reading of it — and the crash page was the one screen still breaking
 * that rule.
 *
 * So the code is a LINK. `onRequestError` has already written the real message,
 * the route and the first stack frames to `app_errors`, keyed by this digest;
 * the Diagnostic page looks it up. One click from "something broke" to the
 * file and the line.
 *
 * Plain French and no next-intl, matching the site boundary and for the same
 * reason: a boundary that needs a translation context fails when the layout is
 * what broke, and then nobody gets anything.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin]', error.digest ?? '', error.message);
  }, [error]);

  return (
    <div className="max-w-xl py-10">
      <h1 className="font-display text-xl font-semibold text-ink">
        Cet écran d’administration n’a pas pu s’afficher
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
        Le serveur a enregistré la cause exacte — message, fichier et ligne. Ouvrez-la avec le code
        ci-dessous plutôt que de deviner.
      </p>

      {error.digest ? (
        <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-white p-4">
          <p className="font-mono text-[13px] break-all text-ink">{error.digest}</p>
          {/* A plain anchor: a client navigation would reuse the React tree
              that just threw, and a full load is the whole point. */}
          <a
            href={`/admin/diagnostics?digest=${encodeURIComponent(error.digest)}`}
            className="mt-3 inline-flex rounded-full bg-brand-500 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-brand-600"
          >
            Voir la cause enregistrée
          </a>
        </div>
      ) : (
        <p className="mt-5 rounded-[var(--radius-card)] border border-dashed border-line bg-surface/50 p-4 text-[12px] leading-relaxed text-ink-muted">
          Cette erreur n’a pas de code. Les dernières erreurs serveur restent consultables sur la
          page Diagnostic.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-brand-300"
        >
          Réessayer
        </button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/admin/diagnostics"
          className="rounded-full border border-line px-4 py-2 text-[13px] text-ink transition-colors hover:border-brand-300"
        >
          Diagnostic
        </a>
      </div>
    </div>
  );
}
