import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

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
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
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
