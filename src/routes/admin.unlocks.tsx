import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Pencil, Trash2, X, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { youtubeId } from '@/lib/youtube';
import {
  PageHeader, TableWrap, Th, Td, EmptyRow, Btn, Field, inputClass, Pill, Toggle,
} from '@/components/admin/AdminUI';
import type { UnlockContent } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/unlocks')({
  component: UnlocksPage,
});

function blankUnlock(): UnlockContent {
  return {
    code: '',
    productName: '',
    message: '',
    body: '',
    linkUrl: '',
    linkLabel: '',
    scans: 0,
    active: true,
  };
}

/** The URL that goes into the printed QR for a code. */
function unlockUrl(code: string): string {
  return `${window.location.origin}/unlock?code=${encodeURIComponent(code)}`;
}

function UnlocksPage() {
  const { t } = useI18n();
  const { unlocks, products, addUnlock, updateUnlock, deleteUnlock } = useGlowStore();
  const [editing, setEditing] = useState<UnlockContent | null>(null);
  const [isNew, setIsNew] = useState(false);
  /** The code being edited, kept so renaming a code can replace the old row. */
  const [originalCode, setOriginalCode] = useState('');

  function save(unlock: UnlockContent) {
    const code = unlock.code.trim().toUpperCase();
    if (!code) {
      toast.error(t('requiredField'));
      return;
    }
    const clean = { ...unlock, code };

    if (isNew) {
      if (unlocks.some(u => u.code.toUpperCase() === code)) {
        toast.error(`${code} — ${t('unlockCode')}`);
        return;
      }
      addUnlock(clean);
    } else if (code !== originalCode.toUpperCase()) {
      // The code is the primary key, so a rename is a delete plus an insert.
      deleteUnlock(originalCode);
      addUnlock(clean);
    } else {
      updateUnlock(originalCode, clean);
    }

    toast.success(t('settingsSaved'));
    setEditing(null);
  }

  function remove(u: UnlockContent) {
    if (!window.confirm(t('deleteUnlockConfirm'))) return;
    deleteUnlock(u.code);
    toast.success(t('delete'));
  }

  async function copyUrl(code: string) {
    try {
      await navigator.clipboard.writeText(unlockUrl(code));
      toast.success(t('copied'));
    } catch {
      /* clipboard blocked — nothing useful to say */
    }
  }

  return (
    <>
      <PageHeader
        title={t('adminUnlocks')}
        subtitle="Each code is printed as a QR inside a garment's care label."
        actions={
          <Btn
            onClick={() => {
              setEditing(blankUnlock());
              setOriginalCode('');
              setIsNew(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('newUnlock')}
          </Btn>
        }
      />

      <TableWrap>
        <thead>
          <tr>
            <Th>{t('unlockCode')}</Th>
            <Th>{t('unlockProduct')}</Th>
            <Th>{t('unlockMessage')}</Th>
            <Th>{t('unlockScanCount')}</Th>
            <Th>{t('orderStatus')}</Th>
            <Th className="w-32" />
          </tr>
        </thead>
        <tbody>
          {unlocks.length === 0 ? (
            <EmptyRow colSpan={6}>{t('noUnlocks')}</EmptyRow>
          ) : (
            unlocks.map(u => (
              <tr key={u.code}>
                <Td>
                  <span className="font-mono text-sm font-medium tracking-wider">{u.code}</span>
                </Td>
                <Td className="text-muted-foreground">{u.productName}</Td>
                <Td className="max-w-[220px] truncate text-muted-foreground">{u.message}</Td>
                <Td className="tabular-nums">{u.scans}</Td>
                <Td>
                  <Pill tone={u.active ? 'good' : 'neutral'}>
                    {u.active ? t('unlockActive') : t('no')}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void copyUrl(u.code)}
                      aria-label={t('copy')}
                      title={t('copy')}
                      className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-secondary"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <a
                      href={`/unlock?code=${encodeURIComponent(u.code)}`}
                      target="_blank"
                      rel="noopener"
                      aria-label={t('openUnlockPage')}
                      title={t('openUnlockPage')}
                      className="rounded-lg p-2 transition-colors hover:bg-secondary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing({ ...u });
                        setOriginalCode(u.code);
                        setIsNew(false);
                      }}
                      aria-label={t('edit')}
                      className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-secondary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      aria-label={t('delete')}
                      className="cursor-pointer rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableWrap>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-charcoal/40 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-xl animate-scale-in rounded-2xl border border-border bg-card shadow-lifted">
            <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
              <h2 className="font-display text-xl">{isNew ? t('newUnlock') : t('editUnlock')}</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label={t('close')}
                className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form
              className="space-y-5 px-6 py-6"
              onSubmit={e => {
                e.preventDefault();
                save(editing);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('unlockCode')}
                  htmlFor="u-code"
                  hint={editing.code ? unlockUrl(editing.code) : undefined}
                >
                  <input
                    id="u-code"
                    required
                    dir="ltr"
                    value={editing.code}
                    onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                    placeholder="SOFT-01"
                    className={cn(inputClass, 'font-mono tracking-wider')}
                  />
                </Field>

                <Field label={t('unlockProduct')} htmlFor="u-product">
                  <input
                    id="u-product"
                    list="gg-products"
                    value={editing.productName}
                    onChange={e => setEditing({ ...editing, productName: e.target.value })}
                    className={inputClass}
                  />
                  <datalist id="gg-products">
                    {products.map(p => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </Field>
              </div>

              <Field
                label={t('unlockMessage')}
                htmlFor="u-message"
                hint="The line that greets whoever scanned it."
              >
                <input
                  id="u-message"
                  value={editing.message}
                  onChange={e => setEditing({ ...editing, message: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label={t('unlockBody')} htmlFor="u-body">
                <textarea
                  id="u-body"
                  rows={4}
                  value={editing.body}
                  onChange={e => setEditing({ ...editing, body: e.target.value })}
                  className={cn(inputClass, 'resize-y')}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('unlockLinkUrl')}
                  htmlFor="u-url"
                  hint={
                    youtubeId(editing.linkUrl)
                      ? '▶ YouTube link — plays right on the unlock page'
                      : 'Paste a YouTube link and it plays inline. Anything else shows as a button.'
                  }
                >
                  <input
                    id="u-url"
                    type="url"
                    dir="ltr"
                    value={editing.linkUrl ?? ''}
                    onChange={e => setEditing({ ...editing, linkUrl: e.target.value })}
                    placeholder="https://youtu.be/…"
                    className={inputClass}
                  />
                </Field>
                <Field label={t('unlockLinkLabel')} htmlFor="u-label">
                  <input
                    id="u-label"
                    value={editing.linkLabel ?? ''}
                    onChange={e => setEditing({ ...editing, linkLabel: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Toggle
                id="u-active"
                checked={editing.active}
                onChange={v => setEditing({ ...editing, active: v })}
                label={t('unlockActive')}
              />

              <div className="flex justify-end gap-2 border-t border-border pt-5">
                <Btn type="button" variant="ghost" onClick={() => setEditing(null)}>
                  {t('cancel')}
                </Btn>
                <Btn type="submit">{t('save_')}</Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
