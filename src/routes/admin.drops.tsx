import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { slugify } from '@/lib/slug';
import {
  PageHeader, TableWrap, Th, Td, EmptyRow, Btn, Field, inputClass, Pill, Toggle,
} from '@/components/admin/AdminUI';
import type { Drop } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/drops')({
  component: DropsAdminPage,
});

function blankDrop(): Drop {
  return {
    id: `d${Date.now()}`,
    slug: '',
    name: '',
    statement: '',
    description: '',
    releasedAt: new Date().toISOString().slice(0, 10),
    published: false,
  };
}

function DropsAdminPage() {
  const { t, locale } = useI18n();
  const { drops, products, addDrop, updateDrop, deleteDrop } = useGlowStore();
  const [editing, setEditing] = useState<Drop | null>(null);
  const [isNew, setIsNew] = useState(false);

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  function save(drop: Drop) {
    if (!drop.name.trim()) {
      toast.error(t('requiredField'));
      return;
    }
    const clean = { ...drop, slug: drop.slug.trim() || slugify(drop.name) || drop.id };
    if (isNew) addDrop(clean);
    else updateDrop(clean.id, clean);
    toast.success(t('settingsSaved'));
    setEditing(null);
  }

  function remove(d: Drop) {
    if (!window.confirm(t('deleteDropConfirm'))) return;
    deleteDrop(d.id);
    toast.success(t('delete'));
  }

  return (
    <>
      <PageHeader
        title={t('adminDrops')}
        subtitle={`${drops.length}`}
        actions={
          <Btn
            onClick={() => {
              setEditing(blankDrop());
              setIsNew(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('newDrop')}
          </Btn>
        }
      />

      <TableWrap>
        <thead>
          <tr>
            <Th>{t('dropName')}</Th>
            <Th>{t('dropStatement')}</Th>
            <Th>{t('orderItems')}</Th>
            <Th>{t('dropReleasedAt')}</Th>
            <Th>{t('orderStatus')}</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {drops.length === 0 ? (
            <EmptyRow colSpan={6}>{t('noDrops')}</EmptyRow>
          ) : (
            drops.map(d => (
              <tr key={d.id}>
                <Td>
                  <span className="font-medium">{d.name}</span>
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                    /{d.slug}
                  </span>
                </Td>
                <Td className="max-w-[220px] truncate text-muted-foreground">{d.statement}</Td>
                <Td className="tabular-nums">{products.filter(p => p.dropId === d.id).length}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {dateFmt.format(new Date(d.releasedAt))}
                </Td>
                <Td>
                  <Pill tone={d.published ? 'good' : 'neutral'}>
                    {d.published ? t('dropPublished') : t('reviewPending')}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing({ ...d });
                        setIsNew(false);
                      }}
                      aria-label={t('edit')}
                      className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-secondary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(d)}
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
              <h2 className="font-display text-xl">{isNew ? t('newDrop') : t('editDrop')}</h2>
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
                <Field label={t('dropName')} htmlFor="d-name">
                  <input
                    id="d-name"
                    required
                    value={editing.name}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('productSlug')} htmlFor="d-slug" hint={`/drops/${editing.slug || slugify(editing.name)}`}>
                  <input
                    id="d-slug"
                    value={editing.slug}
                    onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })}
                    placeholder={slugify(editing.name)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field
                label={t('dropStatement')}
                htmlFor="d-statement"
                hint="Shown mirrored on the drop page — keep it to one line."
              >
                <input
                  id="d-statement"
                  value={editing.statement}
                  onChange={e => setEditing({ ...editing, statement: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label={t('dropDescription')} htmlFor="d-desc">
                <textarea
                  id="d-desc"
                  rows={4}
                  value={editing.description}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  className={cn(inputClass, 'resize-y')}
                />
              </Field>

              <Field label={t('dropReleasedAt')} htmlFor="d-date">
                <input
                  id="d-date"
                  type="date"
                  value={editing.releasedAt.slice(0, 10)}
                  onChange={e => setEditing({ ...editing, releasedAt: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Toggle
                id="d-pub"
                checked={editing.published}
                onChange={v => setEditing({ ...editing, published: v })}
                label={t('dropPublished')}
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
