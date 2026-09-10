import { useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Pencil, Trash2, X, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { slugify } from '@/lib/slug';
import { compressImage } from '@/lib/images';
import { uploadImage } from '@/lib/supabaseSync';
import {
  PageHeader, TableWrap, Th, Td, EmptyRow, Btn, Field, inputClass, Pill, Toggle,
} from '@/components/admin/AdminUI';
import type { JournalPost } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/journal')({
  component: JournalAdminPage,
});

function blankPost(): JournalPost {
  return {
    id: `j${Date.now()}`,
    slug: '',
    title: '',
    excerpt: '',
    body: '',
    tag: '',
    readMinutes: 2,
    published: false,
    createdAt: new Date().toISOString(),
  };
}

/** ~200 words a minute, floored at 1. Keeps the read time honest for free. */
function estimateMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function JournalAdminPage() {
  const { t, locale } = useI18n();
  const { posts, addPost, updatePost, deletePost } = useGlowStore();
  const [editing, setEditing] = useState<JournalPost | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Downscale in the browser, then hand off to Storage when it is configured. */
  async function onCoverFile(files: FileList | null) {
    if (!files?.length || !editing) return;
    setUploading(true);
    try {
      const compressed = await compressImage(files[0]);
      const url = await uploadImage(compressed, `journal/${editing.id}`);
      setEditing(p => (p ? { ...p, coverImage: url } : p));
    } catch (err) {
      console.warn('cover upload failed', err);
      toast.error(t('loading'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-DZ' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  function save(post: JournalPost) {
    if (!post.title.trim()) {
      toast.error(t('requiredField'));
      return;
    }
    const clean: JournalPost = {
      ...post,
      slug: post.slug.trim() || slugify(post.title) || post.id,
      readMinutes: post.readMinutes || estimateMinutes(post.body),
    };
    if (isNew) addPost(clean);
    else updatePost(clean.id, clean);
    toast.success(t('settingsSaved'));
    setEditing(null);
  }

  function remove(p: JournalPost) {
    if (!window.confirm(t('deletePostConfirm'))) return;
    deletePost(p.id);
    toast.success(t('delete'));
  }

  return (
    <>
      <PageHeader
        title={t('adminJournal')}
        subtitle={`${posts.length}`}
        actions={
          <Btn
            onClick={() => {
              setEditing(blankPost());
              setIsNew(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t('newPost')}
          </Btn>
        }
      />

      <TableWrap>
        <thead>
          <tr>
            <Th className="w-20" />
            <Th>{t('postTitle')}</Th>
            <Th>{t('postTag')}</Th>
            <Th>{t('postReadMinutes')}</Th>
            <Th>{t('orderDate')}</Th>
            <Th>{t('orderStatus')}</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {posts.length === 0 ? (
            <EmptyRow colSpan={7}>{t('noPosts')}</EmptyRow>
          ) : (
            posts.map(p => (
              <tr key={p.id}>
                <Td>
                  {p.coverImage ? (
                    <img
                      src={p.coverImage}
                      alt=""
                      width={56}
                      height={40}
                      loading="lazy"
                      className="h-10 w-14 rounded-md bg-secondary object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-14 items-center justify-center rounded-md bg-secondary">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="font-medium">{p.title}</span>
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                    /{p.slug}
                  </span>
                </Td>
                <Td className="text-muted-foreground">{p.tag}</Td>
                <Td className="tabular-nums">{p.readMinutes}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {dateFmt.format(new Date(p.createdAt))}
                </Td>
                <Td>
                  <Pill tone={p.published ? 'good' : 'neutral'}>
                    {p.published ? t('postPublished') : t('reviewPending')}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing({ ...p });
                        setIsNew(false);
                      }}
                      aria-label={t('edit')}
                      className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-secondary"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p)}
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
          <div className="my-8 w-full max-w-2xl animate-scale-in rounded-2xl border border-border bg-card shadow-lifted">
            <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
              <h2 className="font-display text-xl">{isNew ? t('newPost') : t('editPost')}</h2>
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
              <Field label={t('postTitle')} htmlFor="j-title">
                <input
                  id="j-title"
                  required
                  value={editing.title}
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  label={t('productSlug')}
                  htmlFor="j-slug"
                  className="sm:col-span-2"
                  hint={`/journal/${editing.slug || slugify(editing.title)}`}
                >
                  <input
                    id="j-slug"
                    value={editing.slug}
                    onChange={e => setEditing({ ...editing, slug: slugify(e.target.value) })}
                    placeholder={slugify(editing.title)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('postTag')} htmlFor="j-tag">
                  <input
                    id="j-tag"
                    value={editing.tag}
                    onChange={e => setEditing({ ...editing, tag: e.target.value })}
                    placeholder="overthinking"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field
                label={t('postCover')}
                hint={t('postCoverHint')}
              >
                {editing.coverImage ? (
                  <div className="relative w-fit">
                    <img
                      src={editing.coverImage}
                      alt=""
                      className="h-32 w-56 rounded-xl border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, coverImage: undefined })}
                      aria-label={t('delete')}
                      className="absolute -end-1.5 -top-1.5 cursor-pointer rounded-full bg-destructive p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex h-32 w-56 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={e => void onCoverFile(e.target.files)}
                  className="hidden"
                />
                <Btn
                  type="button"
                  variant="ghost"
                  disabled={uploading}
                  className="mt-2"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? t('loading') : editing.coverImage ? t('edit') : t('addImage')}
                </Btn>
              </Field>

              <Field label={t('postExcerpt')} htmlFor="j-excerpt">
                <textarea
                  id="j-excerpt"
                  rows={2}
                  value={editing.excerpt}
                  onChange={e => setEditing({ ...editing, excerpt: e.target.value })}
                  className={cn(inputClass, 'resize-y')}
                />
              </Field>

              <Field
                label={t('postBody')}
                htmlFor="j-body"
                hint="Blank lines become paragraphs."
              >
                <textarea
                  id="j-body"
                  rows={12}
                  value={editing.body}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      body: e.target.value,
                      readMinutes: estimateMinutes(e.target.value),
                    })
                  }
                  className={cn(inputClass, 'resize-y leading-relaxed')}
                />
              </Field>

              <div className="flex flex-wrap items-end gap-6">
                <Field label={t('postReadMinutes')} htmlFor="j-min" className="w-32">
                  <input
                    id="j-min"
                    type="number"
                    min={1}
                    value={editing.readMinutes}
                    onChange={e => setEditing({ ...editing, readMinutes: Number(e.target.value) })}
                    className={inputClass}
                  />
                </Field>
                <div className="pb-3">
                  <Toggle
                    id="j-pub"
                    checked={editing.published}
                    onChange={v => setEditing({ ...editing, published: v })}
                    label={t('postPublished')}
                  />
                </div>
              </div>

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
