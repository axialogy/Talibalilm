import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { GlowProvider } from '@/context/GlowStore';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useI18n } from '@/i18n';

function RootLayout() {
  const location = useLocation();
  const { dir } = useI18n();
  // The dashboard has its own sidebar chrome — no storefront header there.
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="flex min-h-screen flex-col">
      {!isAdmin && <Navbar />}
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      {!isAdmin && <Footer />}
      <Toaster
        position={dir === 'rtl' ? 'top-left' : 'top-right'}
        dir={dir}
        toastOptions={{
          style: {
            fontFamily: 'inherit',
            borderRadius: '12px',
          },
        }}
      />
    </div>
  );
}

export const Route = createRootRoute({
  component: () => (
    <GlowProvider>
      <RootLayout />
    </GlowProvider>
  ),
});
