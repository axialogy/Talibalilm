'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { voidCoupon } from '@/app/actions/office';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

export interface CsvRow {
  code: string;
  batch: string;
  discount: string;
  used: number;
  max: number | null;
  spent: boolean;
}

/** Download the visible coupons as CSV, built in the browser from the rows. */
export function ExportCsvButton({ rows, filename }: { rows: CsvRow[]; filename: string }) {
  const t = useTranslations('admin');

  const download = () => {
    const header = 'code,batch,discount,used,max,status';
    const body = rows
      .map((r) =>
        [r.code, r.batch, r.discount, r.used, r.max ?? '', r.spent ? 'spent' : 'available']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={download} disabled={rows.length === 0}>
      <Download className="size-3.5" aria-hidden="true" />
      {t('exportCsv')}
    </Button>
  );
}

/** Void a single code, with a reason collected at the click. */
export function VoidCouponButton({ couponId }: { couponId: string }) {
  const t = useTranslations('admin');
  const [, action] = useActionState(voidCoupon, EMPTY);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const reason = window.prompt(t('voidReasonPrompt'));
        if (reason === null) {
          event.preventDefault();
          return;
        }
        (event.currentTarget.elements.namedItem('reason') as HTMLInputElement).value = reason;
      }}
    >
      <input type="hidden" name="couponId" value={couponId} />
      <input type="hidden" name="reason" value="" />
      <Button type="submit" size="sm" variant="ghost">
        {t('couponVoid')}
      </Button>
    </form>
  );
}
