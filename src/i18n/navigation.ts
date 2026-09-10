import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for next/link and the navigation hooks. Import
 * these everywhere instead of `next/link`, or Arabic pages will link back into
 * French ones.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
