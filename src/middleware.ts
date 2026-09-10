import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { refreshSession } from '@/lib/supabase/middleware';

const handleI18n = createIntlMiddleware(routing);

/** Paths that require a signed-in user. Membership is checked deeper, in RLS. */
const PROTECTED = ['/dashboard', '/admin'];

/** Paths a signed-in user has no business seeing. */
const AUTH_ONLY = ['/login', '/register', '/forgot-password'];

/** Strip a leading `/fr` or `/ar` so route matching is locale-agnostic. */
function withoutLocale(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return '/';
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
  }
  return pathname;
}

/**
 * The locale prefix the request came in with, so a redirect stays in the
 * visitor's language. Without this an Arabic reader hitting /ar/dashboard is
 * bounced onto the French login page.
 */
function localePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) return `/${locale}`;
  }
  return '';
}

export async function middleware(request: NextRequest) {
  // Locale first: it decides the final URL, and the session cookies have to be
  // written onto whatever response it produces — including its redirects.
  const response = handleI18n(request);

  const { userId } = await refreshSession(request, response);

  const path = withoutLocale(request.nextUrl.pathname);
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  const isAuthOnly = AUTH_ONLY.some((p) => path === p || path.startsWith(`${p}/`));

  const prefix = localePrefix(request.nextUrl.pathname);

  if (isProtected && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/login`;
    // Bring them back where they were headed once they are signed in.
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthOnly && userId) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/dashboard`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Everything except Next internals and files with an extension. Auth route
  // handlers under /auth are excluded too: they must not be locale-prefixed,
  // because Supabase redirects back to a fixed URL.
  matcher: ['/((?!api|auth|_next/static|_next/image|.*\\..*).*)'],
};
