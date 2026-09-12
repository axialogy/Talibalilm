import { existsSync } from 'node:fs';
import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Resolve the school's artwork HERE, at build time, and inline the answer.
 *
 * It used to be resolved by probing the filesystem at request time. That works
 * for a statically generated page, which is rendered during the build with
 * `public/` on disk — and silently fails inside a serverless function, where
 * Next does not ship `public/` because the CDN serves it. So the public site
 * (prerendered) showed the real lockup while the admin sidebar (rendered per
 * request) fell through to the drawn placeholder. Same code, different moment.
 *
 * Doing it in the config keeps the handover intact — drop a file in, redeploy —
 * without leaving a filesystem read on the request path.
 */
function resolveArtwork(...candidates: string[]): string {
  const found = candidates.find((c) =>
    existsSync(path.join(process.cwd(), 'public', c.replace(/^\//, ''))),
  );
  return found ?? candidates[candidates.length - 1]!;
}

const LOGO_LOCKUP = resolveArtwork(
  '/branding/logo-institut.webp',
  '/branding/logo-institut.png',
  '/branding/logo-institut.jpg',
  '/branding/logo-institut.svg',
);
const LOGO_MARK = resolveArtwork(
  '/branding/logo-mark.webp',
  '/branding/logo-mark.png',
  '/branding/logo-mark.jpg',
  '/branding/logo-mark.svg',
);

/**
 * The classroom runs in a cross-origin iframe, and a Permissions-Policy of
 * `camera=(self)` shuts the camera off inside it — the room would load and then
 * nobody could be seen. The Jitsi origin is named explicitly rather than opened
 * to `*`, and `display-capture` stays first-party because screen recording is
 * ours, not the iframe's.
 */
const JITSI_ORIGIN = `https://${process.env.NEXT_PUBLIC_JITSI_DOMAIN?.trim() || 'meet.jit.si'}`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Inlined at build time; read through `@/lib/artwork`.
  env: {
    NEXT_PUBLIC_LOGO_LOCKUP: LOGO_LOCKUP,
    NEXT_PUBLIC_LOGO_MARK: LOGO_MARK,
  },

  // `typedRoutes` is off deliberately. It types the *filesystem* routes, which
  // under next-intl all live beneath `[locale]`, while next-intl's Link and
  // redirect take locale-less paths like `/courses`. The two never agree, and
  // the result is a cast at every call site — which is worse than no typing.
  // Route-level type safety comes back via next-intl's `pathnames` config when
  // we localise the URL segments themselves.

  // Supabase Storage serves avatars and course covers; nothing else is
  // remote yet. Each new host has to be added deliberately.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: [
              `camera=(self "${JITSI_ORIGIN}")`,
              `microphone=(self "${JITSI_ORIGIN}")`,
              `display-capture=(self "${JITSI_ORIGIN}")`,
              'geolocation=()',
            ].join(', '),
          },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
