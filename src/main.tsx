import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { I18nProvider } from './i18n';
import './index.css';

/**
 * Clean URLs, not hash routing.
 *
 * The trade is a server rewrite: every path has to serve index.html, which
 * vercel.json now does. Worth it for two reasons — /admin reads properly on a
 * business card, and Supabase puts password-recovery tokens in the URL hash,
 * which a hash router would eat before supabase-js could read them.
 */
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>
  </StrictMode>,
);
