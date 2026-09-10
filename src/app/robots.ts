import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Nothing here is secret — these routes are guarded server-side — but
      // there is no reason to spend crawl budget on them.
      disallow: ['/dashboard', '/admin', '/auth/', '/login', '/register', '/api/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
