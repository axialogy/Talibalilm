import { useState, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Pencil, Trash2, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useGlowStore } from '@/context/GlowStore';
import { useI18n } from '@/i18n';
import { formatPrice } from '@/lib/pricing';
import { productImage } from '@/lib/productArt';
import { compressImage } from '@/lib/images';
import { uploadImage } from '@/lib/supabaseSync';
import { slugify } from '@/lib/slug';
import {
  PageHeader, TableWrap, Th, Td, EmptyRow, Btn, Field, inputClass, Pill, Toggle,
} from '@/components/admin/AdminUI';
import type { Product, ProductCategory, Size, ColorOption, PriceTier } from '@/types';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/products')({
  component: ProductsPage,
});

const CATEGORIES: ProductCategory[] = ['tee', 'hoodie', 'crewneck', 'cap', 'accessory'];
const ALL_SIZES: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ONE SIZE'];

function blankProduct(): Product {
  return {
    id: `p${Date.now()}`,
    slug: '',
    name: '',
    tagline: '',
    description: '',
    category: 'tee',
    material: '',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [{ name: 'Dusty Pink', hex: '#e0cdc9' }],
    price: 3200,
    offers: [],
    images: [],
    mirrorMessage: '',
    mirrorPlacement: 'front chest, reversed',
    unlockCode: '',
    features: [],
    inStock: true,
    featured: false,
  };
}

function ProductsPage() {
  const { t } = useI18n();
  const { products, drops, addProduct, updateProduct, deleteProduct } = useGlowStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);

  function startNew() {
    setEditing(blankProduct());
    setIsNew(true);
  }

  function startEdit(p: Product) {
    // Deep-ish copy so cancelling leaves the stored product untouched.
    setEditing({
      ...p,
      sizes: [...p.sizes],
      colors: p.colors.map(c => ({ ...c })),
      images: [...p.images],
      features: [...p.features],
      offers: (p.offers ?? []).map(o => ({ ...o })),
    });
    setIsNew(false);
  }

  function save(product: Product) {
    const slug = product.slug.trim() || slugify(product.name) || product.id;
    const clean: Product = { ...product, slug };

    if (!clean.name.trim()) {
      toast.error(t('requiredField'));
      return;
    }
    if (isNew) addProduct(clean);
    else updateProduct(clean.id, clean);

    toast.success(t('settingsSaved'));
    setEditing(null);
  }

  function remove(p: Product) {
    if (!window.confirm(t('deleteProductConfirm'))) return;
    deleteProduct(p.id);
    toast.success(t('delete'));
  }

  return (
    <>
      <PageHeader
        title={t('adminProducts')}
        subtitle={`${products.length}`}
        actions={
          <Btn onClick={startNew}>
            <Plus className="h-4 w-4" />
            {t('newProduct')}
          </Btn>
        }
      />

      <TableWrap>
        <thead>
          <tr>
            <Th className="w-16" />
            <Th>{t('productName')}</Th>
            <Th>{t('productCategory')}</Th>
            <Th>{t('productPrice')}</Th>
            <Th>{t('orderStatus')}</Th>
            <Th className="w-24" />
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <EmptyRow colSpan={6}>{t('noProductsAdmin')}</EmptyRow>
          ) : (
            products.map(p => (
              <tr key={p.id}>
                <Td>
                  <img
                    src={productImage(p, 0)}
                    alt=""
                    width={44}
                    height={54}
                    loading="lazy"
                    className="h-14 w-11 rounded-lg bg-secondary object-cover"
                  />
                </Td>
                <Td>
                  <span className="font-medium">{p.name}</span>
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                    /{p.slug}
                  </span>
                </Td>
                <Td className="text-muted-foreground">{p.category}</Td>
                <Td className="whitespace-nowrap tabular-nums">{formatPrice(p.price)}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill tone={p.inStock ? 'good' : 'bad'}>
                      {p.inStock ? t('inStock') : t('soldOut')}
                    </Pill>
                    {p.featured && <Pill tone="info">{t('featuredTitle')}</Pill>}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
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
        <ProductEditor
          product={editing}
          drops={drops}
          isNew={isNew}
          onChange={setEditing}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

function ProductEditor({
  product,
  drops,
  isNew,
  onChange,
  onSave,
  onClose,
}: {
  product: Product;
  drops: { id: string; name: string }[];
  isNew: boolean;
  onChange: (p: Product) => void;
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const set = <K extends keyof Product>(key: K, value: Product[K]) =>
    onChange({ ...product, [key]: value });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const added: string[] = [];
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file);
        // Goes to Supabase Storage when configured; otherwise stays local.
        added.push(await uploadImage(compressed, product.id));
      }
      onChange({ ...product, images: [...product.images, ...added] });
    } catch (err) {
      console.warn('image add failed', err);
      toast.error(t('loading'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const toggleSize = (s: Size) =>
    set('sizes', product.sizes.includes(s) ? product.sizes.filter(x => x !== s) : [...product.sizes, s]);

  const setColor = (i: number, patch: Partial<ColorOption>) =>
    set('colors', product.colors.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const setOffer = (i: number, patch: Partial<PriceTier>) =>
    set('offers', (product.offers ?? []).map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-charcoal/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl animate-scale-in rounded-2xl border border-border bg-card shadow-lifted">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-2xl border-b border-border bg-card px-6 py-4">
          <h2 className="font-display text-xl">{isNew ? t('newProduct') : t('editProduct')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          className="space-y-6 px-6 py-6"
          onSubmit={e => {
            e.preventDefault();
            onSave(product);
          }}
        >
          {/* Basics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('productName')} htmlFor="p-name">
              <input
                id="p-name"
                required
                value={product.name}
                onChange={e => set('name', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t('productSlug')} htmlFor="p-slug" hint={`/shop/${product.slug || slugify(product.name)}`}>
              <input
                id="p-slug"
                value={product.slug}
                onChange={e => set('slug', slugify(e.target.value))}
                placeholder={slugify(product.name)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={t('productTagline')} htmlFor="p-tagline">
            <input
              id="p-tagline"
              value={product.tagline ?? ''}
              onChange={e => set('tagline', e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('productCategory')} htmlFor="p-cat">
              <select
                id="p-cat"
                value={product.category}
                onChange={e => set('category', e.target.value as ProductCategory)}
                className={cn(inputClass, 'cursor-pointer')}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('productDrop')} htmlFor="p-drop">
              <select
                id="p-drop"
                value={product.dropId ?? ''}
                onChange={e => set('dropId', e.target.value || undefined)}
                className={cn(inputClass, 'cursor-pointer')}
              >
                <option value="">—</option>
                {drops.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('productPrice')} htmlFor="p-price">
              <input
                id="p-price"
                type="number"
                min={0}
                required
                value={product.price}
                onChange={e => set('price', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label={t('productOldPrice')} htmlFor="p-old">
              <input
                id="p-old"
                type="number"
                min={0}
                value={product.oldPrice ?? ''}
                onChange={e => set('oldPrice', e.target.value ? Number(e.target.value) : undefined)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label={t('productDescription')} htmlFor="p-desc">
            <textarea
              id="p-desc"
              rows={4}
              value={product.description}
              onChange={e => set('description', e.target.value)}
              className={cn(inputClass, 'resize-y')}
            />
          </Field>

          <Field label={t('productMaterial')} htmlFor="p-mat">
            <input
              id="p-mat"
              value={product.material}
              onChange={e => set('material', e.target.value)}
              className={inputClass}
            />
          </Field>

          {/* Brand signature fields */}
          <fieldset className="rounded-xl border border-border bg-secondary/40 p-5">
            <legend className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('mirrorMessageLabel')}
            </legend>
            <div className="space-y-4">
              <Field label={t('mirrorMessageLabel')} htmlFor="p-mirror">
                <input
                  id="p-mirror"
                  value={product.mirrorMessage ?? ''}
                  onChange={e => set('mirrorMessage', e.target.value)}
                  placeholder="you're doing better than you think."
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('mirrorPlacementLabel')} htmlFor="p-place">
                  <input
                    id="p-place"
                    value={product.mirrorPlacement ?? ''}
                    onChange={e => set('mirrorPlacement', e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t('unlockCodeLabel')} htmlFor="p-code">
                  <input
                    id="p-code"
                    value={product.unlockCode ?? ''}
                    onChange={e => set('unlockCode', e.target.value.toUpperCase())}
                    placeholder="SOFT-01"
                    dir="ltr"
                    className={cn(inputClass, 'font-mono')}
                  />
                </Field>
              </div>
            </div>
          </fieldset>

          {/* Sizes */}
          <Field label={t('productSizes')}>
            <div className="flex flex-wrap gap-2">
              {ALL_SIZES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  aria-pressed={product.sizes.includes(s)}
                  className={cn(
                    'cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-all duration-200',
                    product.sizes.includes(s)
                      ? 'border-charcoal bg-charcoal text-white'
                      : 'border-border hover:border-charcoal/30',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>

          {/* Colours */}
          <Field label={t('productColors')}>
            <ul className="space-y-2">
              {product.colors.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c.hex}
                    onChange={e => setColor(i, { hex: e.target.value })}
                    aria-label={t('colorHex')}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                  />
                  <input
                    value={c.name}
                    onChange={e => setColor(i, { name: e.target.value })}
                    placeholder={t('colorName')}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => set('colors', product.colors.filter((_, idx) => idx !== i))}
                    aria-label={t('delete')}
                    className="shrink-0 cursor-pointer rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Btn
              type="button"
              variant="ghost"
              className="mt-2"
              onClick={() => set('colors', [...product.colors, { name: '', hex: '#b0a8be' }])}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('addColor')}
            </Btn>
          </Field>

          {/* Images */}
          <Field label={t('productImages')} hint={t('productImagesHint')}>
            {product.images.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {product.images.map((src, i) => (
                  <li key={i} className="group relative">
                    <img
                      src={src}
                      alt=""
                      width={64}
                      height={80}
                      className="h-20 w-16 rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => set('images', product.images.filter((_, idx) => idx !== i))}
                      aria-label={t('delete')}
                      className="absolute -end-1.5 -top-1.5 cursor-pointer rounded-full bg-destructive p-1 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 start-1 rounded bg-charcoal/80 px-1 text-[9px] text-white">
                        1
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={e => void onFiles(e.target.files)}
              className="hidden"
            />
            <Btn
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? t('loading') : t('addImage')}
            </Btn>
            {product.images.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No photo yet — the shop renders generated art from the colourway and the
                reverse-printed message.
              </p>
            )}
          </Field>

          {/* Bundles */}
          <Field label={t('bundleOffers')}>
            <ul className="space-y-2">
              {(product.offers ?? []).map((o, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={2}
                    value={o.qty}
                    onChange={e => setOffer(i, { qty: Number(e.target.value) })}
                    aria-label={t('offerQty')}
                    className={cn(inputClass, 'w-24')}
                  />
                  <input
                    type="number"
                    min={0}
                    value={o.price}
                    onChange={e => setOffer(i, { price: Number(e.target.value) })}
                    aria-label={t('offerPrice')}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => set('offers', (product.offers ?? []).filter((_, idx) => idx !== i))}
                    aria-label={t('delete')}
                    className="shrink-0 cursor-pointer rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <Btn
              type="button"
              variant="ghost"
              className="mt-2"
              onClick={() => set('offers', [...(product.offers ?? []), { qty: 2, price: product.price * 2 }])}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('addOffer')}
            </Btn>
          </Field>

          <div className="flex flex-wrap gap-5 border-t border-border pt-5">
            <Toggle
              id="p-stock"
              checked={product.inStock}
              onChange={v => set('inStock', v)}
              label={t('productInStock')}
            />
            <Toggle
              id="p-featured"
              checked={Boolean(product.featured)}
              onChange={v => set('featured', v)}
              label={t('productFeatured')}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-5">
            <Btn type="button" variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Btn>
            <Btn type="submit">{t('save_')}</Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
