'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { deleteCursus } from '@/app/actions/catalog';
import type { AdminState } from '@/app/actions/admin';

const EMPTY: AdminState = { ok: true };

/**
 * Delete a cursus, with the refusal explained in words.
 *
 * Everything pointing at a cursus cascades — its programme, its prices and the
 * entitlements students hold — so the action refuses outright once any of that
 * exists and says which. Archiving, on the settings form just above, is the
 * way to retire one that has already been sold.
 */
export function CursusDeleteButton({ cursusId }: { cursusId: string }) {
  const t = useTranslations('admin');
  const [state, remove] = useActionState(deleteCursus, EMPTY);

  return (
    <div className="mt-4">
      <form
        action={remove}
        onSubmit={(event) => {
          if (!window.confirm(t('cursusDeleteConfirm'))) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={cursusId} />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-[13px] text-red-600 transition-colors hover:bg-red-50"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {t('cursusDelete')}
        </button>
      </form>

      {state.error && (
        <p role="alert" className="mt-2 max-w-prose text-[11px] text-red-600">
          {t(`errors.${state.error}` as 'errors.saveFailed')}
        </p>
      )}
    </div>
  );
}
