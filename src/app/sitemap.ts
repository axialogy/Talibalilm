import type { MetadataRoute } from 'next';
import { listCourses } from '@/lib/content/courses';
import { listCursus } from '@/lib/data/commerce';

import { routing } from '@/i18n/routing';
import { siteUrl } from '@/lib/env';

/** Prefix for a locale — the default one is unprefixed, per the routing config. */
function prefix(locale: string): string {
  return locale === routing.defaultLocale ? '' : `/${locale}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  const cursusList = await listCursus();

  for (const locale of routing.locales) {
    const p = prefix(locale);
    entries.push(
      { url: `${base}${p || '/'}`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
      { url: `${base}${p}/courses`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
      { url: `${base}${p}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    );

    for (const course of listCourses()) {
      entries.push({
        url: `${base}${p}/courses/${course.slug}`,
        lastModified: new Date(course.published_at),
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }

    // The cursus pages: one per published cursus, the programme a student
    // lands on after buying one.
    for (const cursus of cursusList) {
      entries.push({
        url: `${base}${p}/cursus/${cursus.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }

  return entries;
}
