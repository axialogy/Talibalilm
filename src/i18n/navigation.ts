import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware replacements for next/link and the navigation hooks. Import
 * these everywhere instead of `next/link`, or English pages will link back into
 * French ones.
 */
const navigation = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = navigation;

/**
 * next-intl types its `redirect` as returning `void`, but it throws — Next's
 * redirect always does, that is how it unwinds the render. Declaring `never`
 * lets the compiler see that the code after a guard is unreachable, so
 * `if (!x) redirect(...)` narrows `x` afterwards instead of every call site
 * having to re-assert what the guard already established.
 */
type IntlRedirect = (...args: Parameters<typeof navigation.redirect>) => never;

// The explicit annotation is load-bearing: TypeScript only applies
// never-returning-call narrowing when the declaration carries one.
export const redirect: IntlRedirect = navigation.redirect as IntlRedirect;
