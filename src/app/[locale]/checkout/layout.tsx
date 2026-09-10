import type { Metadata } from 'next';

// A basket is not a page for a search engine, and a half-filled one is not a
// page for anyone but the person filling it in.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Every step reads the selection cookie and prices it fresh. Stated rather
// than inferred: a checkout that got cached, even briefly, would show one
// student another student's basket.
export const dynamic = 'force-dynamic';

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell max-w-3xl py-10 sm:py-14">
      {children}
    </div>
  );
}
