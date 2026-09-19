'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

/**
 * The failure dialog for the redirect path — the popup was blocked and PayPal
 * sent the student back with an error, or a capture was refused. The popup
 * path shows its own dialog; this is the same message for the arrival that has
 * no live component to report it. The banner underneath stays, so the state is
 * still readable after it is dismissed.
 */
export function ReturnErrorDialog({ message }: { message: string }) {
  const t = useTranslations('checkout');
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} title={t('payErrorTitle')} onClose={() => setOpen(false)}>
      <p>{message}</p>
      <Button type="button" size="md" onClick={() => setOpen(false)}>
        {t('payRetry')}
      </Button>
    </Dialog>
  );
}
