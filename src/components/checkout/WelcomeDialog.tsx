'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Link } from '@/i18n/navigation';

/**
 * The thank-you shown when PayPal brings the student back itself — the popup
 * was blocked, or they had one more step to complete. The popup path already
 * showed its own dialog before navigating, which is why this appears only when
 * the return route asks for it with `welcome=1`: a student reopening their
 * receipt later does not get congratulated again.
 */
export function WelcomeDialog({ href, ctaLabel }: { href: string; ctaLabel: string }) {
  const t = useTranslations('checkout');
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} title={t('confirmTitle')} onClose={() => setOpen(false)}>
      <p>{t('confirmLead')}</p>
      <Button asChild size="md">
        <Link href={href} onClick={() => setOpen(false)}>
          {ctaLabel}
        </Link>
      </Button>
    </Dialog>
  );
}
