/**
 * Supabase backend — optional and egress-aware.
 *
 * Activates only when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
 * Without them the whole app runs from localStorage and never touches the
 * network, so the storefront still works as a local demo.
 *
 * Egress rules this file follows:
 *  - A visitor makes four small GETs on load: products, drops, published
 *    reviews and published journal posts. Images come from Storage's CDN,
 *    never embedded in table rows.
 *  - Orders and unpublished rows are read ONLY inside the admin dashboard,
 *    with row limits.
 *  - Admin notifications use one Realtime websocket. No polling anywhere.
 */
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type {
  Order, Review, Product, CartItem, StoreSettings, Drop, JournalPost, UnlockContent, Customer,
} from '@/types';

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/**
 * Why this is defensive rather than a plain read:
 *
 * These values are pasted by hand into a hosting dashboard, and the usual
 * accidents — a leading space from `KEY = value`, wrapping quotes, a trailing
 * slash — are invisible in that UI. Handing a malformed URL to createClient
 * throws "Invalid supabaseUrl" from inside a dynamically imported module, i.e.
 * an unhandled rejection with no obvious link to the real cause, and every
 * read and write in the app fails at once. Cheaper to sanitise here and say
 * exactly what is wrong.
 */
let configError: string | null = null;

function readEnv(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function normaliseUrl(raw: string): string {
  if (!raw) return '';
  let candidate = raw.replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(candidate)) {
    // A bare project host is a common mis-paste — recover instead of failing.
    if (/^[a-z0-9-]+\.supabase\.(co|in)$/i.test(candidate)) {
      candidate = `https://${candidate}`;
    } else {
      configError = `VITE_SUPABASE_URL is not a URL: "${raw}"`;
      return '';
    }
  }

  try {
    new URL(candidate);
    return candidate;
  } catch {
    configError = `VITE_SUPABASE_URL is not a valid URL: "${raw}"`;
    return '';
  }
}

const url = normaliseUrl(readEnv(import.meta.env.VITE_SUPABASE_URL));
const anonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (url && !anonKey) configError = 'VITE_SUPABASE_ANON_KEY is empty';

let clientPromise: Promise<SupabaseClient | null> | null = null;

export function supabaseEnabled(): boolean {
  return Boolean(url && anonKey);
}

/** A human-readable reason the backend is off, or null when it is fine. */
export function supabaseConfigError(): string | null {
  return configError;
}

/**
 * supabase-js (~100 KB) is imported dynamically so it never lands in the main
 * bundle. It downloads only after the first write or admin read fires.
 */
function getClient(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(url, anonKey, {
          auth: { persistSession: true, autoRefreshToken: true },
          realtime: { params: { eventsPerSecond: 2 } },
        }),
      )
      // Never let a construction failure escape as an unhandled rejection —
      // the app must keep working against localStorage.
      .catch(err => {
        configError = err instanceof Error ? err.message : String(err);
        console.error('[supabase] client could not be created', err);
        return null;
      });
  }
  return clientPromise;
}

/**
 * Public reads go straight to PostgREST with plain fetch(). They are simple
 * GETs and do not need supabase-js, which keeps the client off the critical
 * path leading to the product image (the LCP element on product pages).
 */
async function restGet<T>(path: string): Promise<T[] | null> {
  if (!supabaseEnabled()) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: anonKey!,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T[];
  } catch (err) {
    console.warn('[supabase] read failed', path, err);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Write plumbing                                                      */
/* ------------------------------------------------------------------ */

type WriteErrorListener = (what: string, error: unknown) => void;
const writeErrorListeners = new Set<WriteErrorListener>();

/**
 * Subscribe to failed writes. The dashboard uses this to surface a toast —
 * without it a rejected write is invisible and the admin keeps working on
 * data that only exists in their own browser.
 */
export function onWriteError(listener: WriteErrorListener): () => void {
  writeErrorListeners.add(listener);
  return () => writeErrorListeners.delete(listener);
}

/**
 * Run one write against Supabase.
 *
 * supabase-js RESOLVES with `{ error }` rather than rejecting, so `await`ing a
 * query bare swallows every RLS rejection, constraint violation and unknown
 * column. Each write goes through here so those surface instead of vanishing.
 *
 * Returns false when Supabase is disabled or the write failed; callers are
 * fire-and-forget, and local state is already updated either way.
 */
async function write(
  what: string,
  run: (sb: SupabaseClient) => PromiseLike<{ error: unknown }>,
): Promise<boolean> {
  const sb = await getClient();
  if (!sb) return false;
  try {
    const { error } = await run(sb);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`[supabase] ${what} failed`, err);
    for (const listener of writeErrorListeners) {
      try {
        listener(what, err);
      } catch {
        /* a broken listener must not break the write path */
      }
    }
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  category: Product['category'];
  drop_id: string | null;
  material: string | null;
  sizes: Product['sizes'] | null;
  colors: Product['colors'] | null;
  price: number;
  old_price: number | null;
  offers: Product['offers'] | null;
  images: string[] | null;
  mirror_message: string | null;
  mirror_placement: string | null;
  unlock_code: string | null;
  features: string[] | null;
  in_stock: boolean | null;
  featured: boolean | null;
}

function rowToProduct(r: ProductRow): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline ?? undefined,
    description: r.description ?? '',
    category: r.category,
    dropId: r.drop_id ?? undefined,
    material: r.material ?? '',
    sizes: r.sizes ?? [],
    colors: r.colors ?? [],
    price: Number(r.price),
    oldPrice: r.old_price != null ? Number(r.old_price) : undefined,
    offers: r.offers ?? [],
    images: r.images ?? [],
    mirrorMessage: r.mirror_message ?? undefined,
    mirrorPlacement: r.mirror_placement ?? undefined,
    unlockCode: r.unlock_code ?? undefined,
    features: r.features ?? [],
    inStock: r.in_stock ?? true,
    featured: r.featured ?? false,
  };
}

function productToRow(p: Product) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline ?? null,
    description: p.description,
    category: p.category,
    drop_id: p.dropId ?? null,
    material: p.material,
    sizes: p.sizes,
    colors: p.colors,
    price: p.price,
    old_price: p.oldPrice ?? null,
    offers: p.offers ?? [],
    images: p.images ?? [],
    mirror_message: p.mirrorMessage ?? null,
    mirror_placement: p.mirrorPlacement ?? null,
    unlock_code: p.unlockCode ?? null,
    features: p.features,
    in_stock: p.inStock,
    featured: p.featured ?? false,
  };
}

export async function fetchProducts(): Promise<Product[] | null> {
  const rows = await restGet<ProductRow>('gg_products?select=*&order=created_at.asc&limit=300');
  return rows ? rows.map(rowToProduct) : null;
}

export async function syncProduct(product: Product): Promise<void> {
  await write('save product', sb => sb.from('gg_products').upsert(productToRow(product)));
}

export async function deleteProductRemote(id: string): Promise<void> {
  await write('delete product', sb => sb.from('gg_products').delete().eq('id', id));
}

/**
 * Everything the app holds locally, in the order it must be written.
 *
 * Drops go first: `gg_products.drop_id` is a foreign key to `gg_drops(id)`,
 * so pushing a product before its drop exists fails the whole batch.
 */
export interface LocalData {
  products: Product[];
  drops: Drop[];
  posts: JournalPost[];
  unlocks: UnlockContent[];
  customers: Customer[];
}

export interface PushReport {
  products: number;
  drops: number;
  posts: number;
  unlocks: number;
  customers: number;
  errors: string[];
}

/** Upsert every local row, FK-safe. Returns null when Supabase is disabled. */
export async function pushLocalData(local: LocalData): Promise<PushReport | null> {
  const sb = await getClient();
  if (!sb) return null;

  const report: PushReport = {
    products: 0, drops: 0, posts: 0, unlocks: 0, customers: 0, errors: [],
  };

  // Order matters — drops before products, for the foreign key.
  const steps = [
    ['drops', 'gg_drops', local.drops.map(dropToRow)],
    ['products', 'gg_products', local.products.map(productToRow)],
    ['posts', 'gg_journal', local.posts.map(postToRow)],
    ['unlocks', 'gg_unlocks', local.unlocks.map(unlockToRow)],
    ['customers', 'gg_customers', local.customers.map(customerToRow)],
  ] as const;

  for (const [key, table, rows] of steps) {
    if (rows.length === 0) continue;
    const { error } = await sb.from(table).upsert(rows as object[]);
    if (error) {
      console.error(`[supabase] pushing ${table} failed`, error);
      report.errors.push(`${table}: ${error.message}`);
    } else {
      report[key] = rows.length;
    }
  }

  // A failed catch-up leaves rows stranded in this browser. Say so.
  if (report.errors.length > 0) {
    for (const listener of writeErrorListeners) {
      try {
        listener('upload local data', report.errors.join('; '));
      } catch {
        /* a broken listener must not break the push */
      }
    }
  }

  return report;
}


/* ------------------------------------------------------------------ */
/* Drops                                                               */
/* ------------------------------------------------------------------ */

interface DropRow {
  id: string;
  slug: string;
  name: string;
  statement: string | null;
  description: string | null;
  cover_image: string | null;
  released_at: string;
  published: boolean;
}

function rowToDrop(r: DropRow): Drop {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    statement: r.statement ?? '',
    description: r.description ?? '',
    coverImage: r.cover_image ?? undefined,
    releasedAt: r.released_at,
    published: r.published,
  };
}

export async function fetchDrops(): Promise<Drop[] | null> {
  const rows = await restGet<DropRow>('gg_drops?select=*&order=released_at.desc&limit=100');
  return rows ? rows.map(rowToDrop) : null;
}

function dropToRow(d: Drop) {
  return {
    id: d.id,
    slug: d.slug,
    name: d.name,
    statement: d.statement,
    description: d.description,
    cover_image: d.coverImage ?? null,
    released_at: d.releasedAt,
    published: d.published,
  };
}

export async function syncDrop(drop: Drop): Promise<void> {
  await write('save drop', sb => sb.from('gg_drops').upsert(dropToRow(drop)));
}

export async function deleteDropRemote(id: string): Promise<void> {
  await write('delete drop', sb => sb.from('gg_drops').delete().eq('id', id));
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

interface OrderRow {
  id: string;
  customer_name: string;
  phone: string | null;
  wilaya: string | null;
  address: string | null;
  delivery_method: 'home' | 'desk' | null;
  notes: string | null;
  items: CartItem[] | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: Order['status'];
  created_at: string;
}

export function rowToOrder(r: OrderRow): Order {
  return {
    id: r.id,
    customerName: r.customer_name,
    phone: r.phone ?? undefined,
    wilaya: r.wilaya ?? undefined,
    address: r.address ?? undefined,
    deliveryMethod: r.delivery_method ?? undefined,
    notes: r.notes ?? undefined,
    items: r.items ?? [],
    subtotal: Number(r.subtotal),
    deliveryFee: Number(r.delivery_fee),
    total: Number(r.total),
    status: r.status,
    createdAt: r.created_at,
  };
}

/** Admin only. */
export async function fetchOrders(): Promise<Order[] | null> {
  const sb = await getClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('gg_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(400);
    if (error) throw error;
    return (data as OrderRow[]).map(rowToOrder);
  } catch (err) {
    console.warn('[supabase] orders fetch failed', err);
    return null;
  }
}

export async function syncOrder(order: Order): Promise<void> {
  await write('place order', sb =>
    sb.from('gg_orders').insert({
      id: order.id,
      customer_name: order.customerName,
      phone: order.phone ?? null,
      wilaya: order.wilaya ?? null,
      address: order.address ?? null,
      delivery_method: order.deliveryMethod ?? null,
      notes: order.notes ?? null,
      items: order.items,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      total: order.total,
      status: order.status,
      created_at: order.createdAt,
    }),
  );
}

export async function syncOrderStatus(id: string, status: Order['status']): Promise<void> {
  await write('update order status', sb =>
    sb.from('gg_orders').update({ status }).eq('id', id),
  );
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

interface ReviewRow {
  id: string;
  product_id: string;
  product_name: string;
  name: string;
  rating: number;
  comment: string;
  published: boolean;
  created_at: string;
}

function rowToReview(r: ReviewRow): Review {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    name: r.name,
    rating: r.rating,
    comment: r.comment,
    published: r.published,
    createdAt: r.created_at,
  };
}

export async function fetchPublishedReviews(): Promise<Review[] | null> {
  const rows = await restGet<ReviewRow>(
    'gg_reviews?select=*&published=eq.true&order=created_at.desc&limit=300',
  );
  return rows ? rows.map(rowToReview) : null;
}

/** Admin only: every review, including ones awaiting approval. */
export async function fetchAllReviews(): Promise<Review[] | null> {
  const sb = await getClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('gg_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data as ReviewRow[]).map(rowToReview);
  } catch (err) {
    console.warn('[supabase] all-reviews fetch failed', err);
    return null;
  }
}

export async function syncReview(review: Review): Promise<void> {
  await write('submit review', sb =>
    sb.from('gg_reviews').insert({
      id: review.id,
      product_id: review.productId,
      product_name: review.productName,
      name: review.name,
      rating: review.rating,
      comment: review.comment,
      published: review.published,
      created_at: review.createdAt,
    }),
  );
}

export async function syncReviewPublished(id: string, published: boolean): Promise<void> {
  await write('publish review', sb =>
    sb.from('gg_reviews').update({ published }).eq('id', id),
  );
}

export async function deleteReviewRemote(id: string): Promise<void> {
  await write('delete review', sb => sb.from('gg_reviews').delete().eq('id', id));
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

interface JournalRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  tag: string | null;
  read_minutes: number | null;
  cover_image: string | null;
  published: boolean;
  created_at: string;
}

function rowToPost(r: JournalRow): JournalPost {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt ?? '',
    body: r.body ?? '',
    tag: r.tag ?? '',
    readMinutes: r.read_minutes ?? 2,
    coverImage: r.cover_image ?? undefined,
    published: r.published,
    createdAt: r.created_at,
  };
}

export async function fetchPublishedPosts(): Promise<JournalPost[] | null> {
  const rows = await restGet<JournalRow>(
    'gg_journal?select=*&published=eq.true&order=created_at.desc&limit=100',
  );
  return rows ? rows.map(rowToPost) : null;
}

export async function fetchAllPosts(): Promise<JournalPost[] | null> {
  const sb = await getClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('gg_journal')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data as JournalRow[]).map(rowToPost);
  } catch (err) {
    console.warn('[supabase] journal fetch failed', err);
    return null;
  }
}

function postToRow(p: JournalPost) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body,
    tag: p.tag,
    read_minutes: p.readMinutes,
    cover_image: p.coverImage ?? null,
    published: p.published,
    created_at: p.createdAt,
  };
}

export async function syncPost(post: JournalPost): Promise<void> {
  await write('save journal note', sb => sb.from('gg_journal').upsert(postToRow(post)));
}

export async function deletePostRemote(id: string): Promise<void> {
  await write('delete journal note', sb => sb.from('gg_journal').delete().eq('id', id));
}

/* ------------------------------------------------------------------ */
/* Unlock codes (hidden QR)                                            */
/* ------------------------------------------------------------------ */

interface UnlockRow {
  code: string;
  product_name: string | null;
  message: string | null;
  body: string | null;
  link_url: string | null;
  link_label: string | null;
  scans: number | null;
  active: boolean;
}

function rowToUnlock(r: UnlockRow): UnlockContent {
  return {
    code: r.code,
    productName: r.product_name ?? '',
    message: r.message ?? '',
    body: r.body ?? '',
    linkUrl: r.link_url ?? undefined,
    linkLabel: r.link_label ?? undefined,
    scans: r.scans ?? 0,
    active: r.active,
  };
}

/** Public: one code at a time, looked up when a QR is scanned. */
export async function fetchUnlock(code: string): Promise<UnlockContent | null> {
  const rows = await restGet<UnlockRow>(
    `gg_unlocks?select=*&code=eq.${encodeURIComponent(code)}&active=eq.true&limit=1`,
  );
  return rows?.[0] ? rowToUnlock(rows[0]) : null;
}

export async function fetchAllUnlocks(): Promise<UnlockContent[] | null> {
  const sb = await getClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('gg_unlocks').select('*').limit(200);
    if (error) throw error;
    return (data as UnlockRow[]).map(rowToUnlock);
  } catch (err) {
    console.warn('[supabase] unlocks fetch failed', err);
    return null;
  }
}

function unlockToRow(u: UnlockContent) {
  return {
    code: u.code,
    product_name: u.productName,
    message: u.message,
    body: u.body,
    link_url: u.linkUrl ?? null,
    link_label: u.linkLabel ?? null,
    scans: u.scans,
    active: u.active,
  };
}

export async function syncUnlock(unlock: UnlockContent): Promise<void> {
  await write('save unlock code', sb => sb.from('gg_unlocks').upsert(unlockToRow(unlock)));
}

export async function deleteUnlockRemote(code: string): Promise<void> {
  await write('delete unlock code', sb => sb.from('gg_unlocks').delete().eq('code', code));
}

/** Counts a scan. Uses an RPC so the increment is atomic under concurrency. */
export async function recordUnlockScan(code: string): Promise<void> {
  await write('count scan', sb => sb.rpc('gg_increment_scan', { p_code: code }));
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  wilaya: string | null;
  orders: number;
  total_spent: number;
  tag: Customer['tag'];
  note: string | null;
  joined_at: string;
}

function rowToCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    wilaya: r.wilaya ?? undefined,
    orders: r.orders,
    totalSpent: Number(r.total_spent),
    tag: r.tag ?? 'unrated',
    note: r.note ?? undefined,
    joinedAt: r.joined_at,
  };
}

function customerToRow(c: Customer) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    wilaya: c.wilaya ?? null,
    orders: c.orders,
    total_spent: c.totalSpent,
    tag: c.tag ?? 'unrated',
    note: c.note ?? null,
    joined_at: c.joinedAt,
  };
}

/** Admin only — customer records carry phone numbers. */
export async function fetchCustomers(): Promise<Customer[] | null> {
  const sb = await getClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('gg_customers')
      .select('*')
      .order('total_spent', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data as CustomerRow[]).map(rowToCustomer);
  } catch (err) {
    console.warn('[supabase] customers fetch failed', err);
    return null;
  }
}

export async function syncCustomer(customer: Customer): Promise<void> {
  await write('save customer', sb => sb.from('gg_customers').upsert(customerToRow(customer)));
}

/* ------------------------------------------------------------------ */
/* Settings (single shared row)                                        */
/* ------------------------------------------------------------------ */

export async function fetchSettings(): Promise<StoreSettings | null> {
  const rows = await restGet<{ data: StoreSettings }>('gg_settings?select=data&id=eq.main');
  return rows?.[0]?.data ?? null;
}

export async function syncSettings(settings: StoreSettings): Promise<void> {
  await write('save settings', sb =>
    sb.from('gg_settings').upsert({ id: 'main', data: settings }),
  );
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

/**
 * Upload a compressed data-URL image to the public product-images bucket.
 * Returns the CDN URL, or the original data URL when Supabase is disabled or
 * the upload fails, so the local fallback keeps working either way.
 */
export async function uploadImage(dataUrl: string, folder: string): Promise<string> {
  const sb = await getClient();
  if (!sb || !dataUrl.startsWith('data:')) return dataUrl;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${folder}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`;
    const { error } = await sb.storage
      .from('product-images')
      .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    if (error) throw error;
    const { data } = sb.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    // Falling back to the inline data URL keeps the editor usable, but it
    // lands in localStorage and counts against the ~5MB quota — so this is a
    // real failure the admin needs told about, not a quiet downgrade.
    console.error('[supabase] image upload failed, keeping local copy', err);
    for (const listener of writeErrorListeners) {
      try {
        listener('upload image', err);
      } catch {
        /* a broken listener must not break the upload path */
      }
    }
    return dataUrl;
  }
}

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

/**
 * Real sign-in, replacing the client-side credential check this dashboard
 * used to ship with.
 *
 * The difference is not cosmetic. Comparing a password in the browser can
 * only hide the dashboard, because the password and the database key both
 * travel to every visitor. Signing in here returns a JWT that Postgres itself
 * validates, so the RLS policies — not the UI — decide what may be written.
 * A forged client gets nothing the policies do not already allow.
 */
export interface AuthUser {
  id: string;
  email: string;
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: AuthUser | null; error: string | null }> {
  const sb = await getClient();
  if (!sb) return { user: null, error: 'Supabase is not configured for this deployment.' };

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { user: null, error: error.message };
    if (!data.user?.email) return { user: null, error: 'Sign-in returned no user.' };
    return { user: { id: data.user.id, email: data.user.email }, error: null };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a password-reset email.
 *
 * Always reports success, even for an address with no account. Saying "no
 * such user" would turn this form into a way to test which emails are
 * registered, and the shop owner is the only account here.
 */
export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  const sb = await getClient();
  if (!sb) return { error: 'Supabase is not configured for this deployment.' };

  try {
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      // Supabase appends the recovery tokens to this URL's hash.
      redirectTo: `${window.location.origin}/admin/reset`,
    });
    // A rejected send is still worth logging, but not worth telling the form.
    if (error) console.warn('[supabase] reset email failed', error);
    return { error: null };
  } catch (err) {
    console.warn('[supabase] reset email failed', err);
    return { error: null };
  }
}

/**
 * Set a new password for the session opened by a recovery link.
 * supabase-js parses those tokens out of the URL on load, so by the time the
 * reset page renders there is a usable session to update.
 */
export async function updatePassword(password: string): Promise<{ error: string | null }> {
  const sb = await getClient();
  if (!sb) return { error: 'Supabase is not configured for this deployment.' };

  try {
    const { error } = await sb.auth.updateUser({ password });
    return { error: error ? error.message : null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function signOut(): Promise<void> {
  const sb = await getClient();
  if (!sb) return;
  try {
    await sb.auth.signOut();
  } catch (err) {
    console.warn('[supabase] sign-out failed', err);
  }
}

/** The signed-in admin, or null. Used to restore a session after a reload. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const sb = await getClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session?.user?.email) return null;
    return { id: data.session.user.id, email: data.session.user.email };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Realtime                                                            */
/* ------------------------------------------------------------------ */

/**
 * Admin-side realtime notifications: one websocket, INSERT events only.
 * Returns an unsubscribe function.
 */
export function subscribeToNewActivity(
  onOrder: (row: OrderRow) => void,
  onReview?: (row: ReviewRow) => void,
): () => void {
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  void getClient().then(sb => {
    if (!sb || cancelled) return;
    channel = sb
      .channel('gg-admin-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gg_orders' },
        payload => onOrder(payload.new as OrderRow),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gg_reviews' },
        payload => onReview?.(payload.new as ReviewRow),
      )
      .subscribe();
  });

  return () => {
    cancelled = true;
    if (channel) void getClient().then(sb => sb?.removeChannel(channel!));
  };
}

export function reviewRowToReview(r: ReviewRow): Review {
  return rowToReview(r);
}

export type { OrderRow, ReviewRow };
