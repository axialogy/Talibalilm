'use client';

/**
 * The last resort: the root layout itself threw.
 *
 * This replaces the whole document, so it carries its own <html> and <body> and
 * leans on nothing — no fonts, no theme tokens, no providers, no translations.
 * Everything it might have depended on is, by definition, what just failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#fbfaf8',
          color: '#16221f',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            Le site est momentanément indisponible
          </h1>
          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              color: '#637471',
            }}
          >
            Réessayez dans un instant. Si cela se répète, communiquez le code ci-dessous.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: '1rem',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.75rem',
                color: '#637471',
              }}
            >
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '2rem',
              border: 0,
              borderRadius: '999px',
              background: '#16221f',
              color: '#fff',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
