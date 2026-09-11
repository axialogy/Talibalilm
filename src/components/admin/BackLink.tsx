import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/**
 * A consistent "up one level" control for admin pages.
 *
 * The sidebar is the primary navigation, but a back arrow at the top of each
 * page matches what people expect and gives touch users a large target that is
 * not the narrow sidebar. `href` points at the logical parent, not the browser
 * history, so it behaves the same however the page was reached.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-2 text-xs text-ink-muted transition-colors hover:text-brand-600"
    >
      <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
      {label}
    </Link>
  );
}
