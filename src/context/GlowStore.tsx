import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type {
  Product, Drop, JournalPost, UnlockContent, Order, Review, Customer,
  CartItem, CheckoutInfo, AppNotification, AppSession, StoreSettings,
} from '@/types';
import {
  seedProducts, seedDrops, seedPosts, seedUnlocks, seedReviews, seedOrders, seedCustomers,
} from '@/data/seed';
import { computeTotal, setCurrencySymbol, deliveryFeeFor } from '@/lib/pricing';
import {
  supabaseEnabled, fetchProducts, fetchDrops, fetchPublishedReviews, fetchPublishedPosts,
  fetchSettings, fetchOrders, fetchAllReviews, fetchAllPosts, fetchAllUnlocks, fetchUnlock,
  syncProduct, deleteProductRemote, pushLocalData, syncDrop, deleteDropRemote,
  syncOrder, syncOrderStatus, syncReview, syncReviewPublished, deleteReviewRemote,
  syncPost, deletePostRemote, syncUnlock, deleteUnlockRemote, recordUnlockScan, syncSettings,
  fetchCustomers, syncCustomer, getCurrentUser, signOut,
} from '@/lib/supabaseSync';

export const defaultSettings: StoreSettings = {
  brandName: 'Grow & Glow',
  brandColor: '#b0a8be',
  tagline: 'grow through it. glow through it.',
  email: 'hello@growandglow.dz',
  phone: '0555 00 00 00',
  instagram: 'growandglow.dz',
  tiktok: 'growandglow.dz',
  address: 'Alger, Algeria',
  currency: 'DA',
  deliveryHome: 600,
  deliveryDesk: 400,
  freeDeliveryOver: 7000,
  announcement: 'Free delivery over 7 000 DA — cash on delivery, all 58 wilayas',
};

/** Darken a hex colour for hover states. */
function darken(hex: string, factor = 0.85): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Push settings into the live UI: CSS variables, currency, tab title. */
function applySettings(s: StoreSettings) {
  setCurrencySymbol(s.currency);
  const root = document.documentElement;
  root.style.setProperty('--brand', s.brandColor);
  root.style.setProperty('--brand-hover', darken(s.brandColor));
  if (s.brandName.trim()) {
    document.title = `${s.brandName.trim()} — ${s.tagline || 'grow through it'}`;
  }
}

/**
 * Bumped to v2 at handover. The dashboard pushes local rows up on every load,
 * so a browser still holding the old demo catalogue would silently restore it
 * into the client's empty database. Changing the key retires that cache
 * instead of relying on anyone remembering to clear site data.
 */
const STORAGE_KEY = 'grow-glow-store-v2';

interface GlowState {
  products: Product[];
  drops: Drop[];
  posts: JournalPost[];
  unlocks: UnlockContent[];
  orders: Order[];
  reviews: Review[];
  customers: Customer[];
  notifications: AppNotification[];
  session: AppSession;
  cart: CartItem[];
  settings: StoreSettings;
}

interface GlowActions {
  /* Catalog */
  addProduct: (p: Product) => void;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addDrop: (d: Drop) => void;
  updateDrop: (id: string, updates: Partial<Drop>) => void;
  deleteDrop: (id: string) => void;

  /* Journal */
  addPost: (p: JournalPost) => void;
  updatePost: (id: string, updates: Partial<JournalPost>) => void;
  deletePost: (id: string) => void;

  /* Unlock codes */
  addUnlock: (u: UnlockContent) => void;
  updateUnlock: (code: string, updates: Partial<UnlockContent>) => void;
  deleteUnlock: (code: string) => void;
  /** Looks a code up (remote first, then local) and counts the scan. */
  redeemUnlock: (code: string) => Promise<UnlockContent | null>;

  /* Cart */
  addToCart: (item: CartItem) => void;
  updateCartQuantity: (index: number, quantity: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  cartSubtotal: number;
  cartCount: number;

  /* Orders */
  placeOrder: (items: CartItem[], info: CheckoutInfo) => Order;
  updateOrderStatus: (id: string, status: Order['status']) => void;

  /* Reviews */
  addReview: (review: Omit<Review, 'id' | 'published' | 'createdAt'>) => void;
  setReviewPublished: (id: string, published: boolean) => void;
  deleteReview: (id: string) => void;

  /* Admin plumbing */
  /** Rate a buyer, or leave a private note about them. */
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  ingestRemoteOrder: (order: Order) => void;
  ingestRemoteReview: (review: Review) => void;
  loadAdminData: () => Promise<void>;
  updateSettings: (settings: StoreSettings) => void;
  pushNotification: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markNotificationsRead: () => void;
  login: (user: { name: string; email: string; role: string }) => void;
  logout: () => void;
}

const GlowContext = createContext<(GlowState & GlowActions) | null>(null);

function loadInitialState(): GlowState {
  const fallback: GlowState = {
    products: seedProducts,
    drops: seedDrops,
    posts: seedPosts,
    unlocks: seedUnlocks,
    orders: seedOrders,
    reviews: seedReviews,
    customers: seedCustomers,
    notifications: [],
    session: { isAuthenticated: false },
    cart: [],
    settings: defaultSettings,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<GlowState>;
    return {
      ...fallback,
      ...saved,
      // Never restored from storage. A cached "authenticated" flag with no
      // matching Supabase JWT would render the whole dashboard while every
      // write silently failed; the real session is re-checked on mount.
      session: fallback.session,
      settings: { ...defaultSettings, ...(saved.settings ?? {}) },
    };
  } catch {
    return fallback;
  }
}

export function GlowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GlowState>(loadInitialState);
  const persistTimer = useRef<number | null>(null);

  // Mirror of the latest state, so callbacks can read it without re-binding
  // (and without every action re-creating on each keystroke). Written after
  // commit rather than during render — every read happens inside an event
  // handler or an async continuation, which always runs after the effect.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Debounced persistence — the local cache and offline fallback.
  useEffect(() => {
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          // The session is deliberately dropped here — see loadInitialState.
          JSON.stringify(state, (key, value) => (key === 'session' ? undefined : value)),
        );
      } catch (err) {
        console.warn('persist failed (storage full?)', err);
      }
    }, 300);
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, [state]);

  useEffect(() => {
    applySettings(state.settings);
  }, [state.settings]);

  // Re-establish the admin session from Supabase after a reload. supabase-js
  // holds the refresh token, so this survives a restart without the app ever
  // storing an auth flag of its own.
  useEffect(() => {
    if (!supabaseEnabled()) return;
    let cancelled = false;
    void getCurrentUser().then(user => {
      if (cancelled || !user) return;
      setState(s => ({
        ...s,
        session: {
          isAuthenticated: true,
          user: { name: user.email.split('@')[0], email: user.email, role: 'owner' },
        },
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Public data from Supabase. The UI paints from cache first, so this never
  // blocks first render; it just reconciles once the network answers.
  useEffect(() => {
    if (!supabaseEnabled()) return;
    let cancelled = false;
    void (async () => {
      const [products, drops, reviews, posts, settings] = await Promise.all([
        fetchProducts(),
        fetchDrops(),
        fetchPublishedReviews(),
        fetchPublishedPosts(),
        fetchSettings(),
      ]);
      if (cancelled) return;
      setState(s => ({
        ...s,
        products: products && products.length > 0 ? products : s.products,
        drops: drops && drops.length > 0 ? drops : s.drops,
        reviews: reviews ?? s.reviews,
        posts: posts && posts.length > 0 ? posts : s.posts,
        settings: settings ? { ...defaultSettings, ...settings } : s.settings,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Notifications ---- */

  const pushNotification = useCallback((n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
    setState(s => ({
      ...s,
      notifications: [
        {
          ...n,
          id: `n${Date.now()}${Math.floor(Math.random() * 1000)}`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...s.notifications,
      ].slice(0, 50),
    }));
  }, []);

  const markNotificationsRead = useCallback(() => {
    setState(s => ({ ...s, notifications: s.notifications.map(n => ({ ...n, read: true })) }));
  }, []);

  /* ---- Catalog ---- */

  const addProduct = useCallback((p: Product) => {
    setState(s => ({ ...s, products: [...s.products, p] }));
    void syncProduct(p);
  }, []);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    const existing = stateRef.current.products.find(p => p.id === id);
    const merged = existing ? { ...existing, ...updates } : null;
    setState(s => ({
      ...s,
      products: s.products.map(p => (p.id === id ? { ...p, ...updates } : p)),
    }));
    if (merged) void syncProduct(merged);
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setState(s => ({ ...s, products: s.products.filter(p => p.id !== id) }));
    void deleteProductRemote(id);
  }, []);

  const addDrop = useCallback((d: Drop) => {
    setState(s => ({ ...s, drops: [d, ...s.drops] }));
    void syncDrop(d);
  }, []);

  const updateDrop = useCallback((id: string, updates: Partial<Drop>) => {
    const existing = stateRef.current.drops.find(d => d.id === id);
    const merged = existing ? { ...existing, ...updates } : null;
    setState(s => ({ ...s, drops: s.drops.map(d => (d.id === id ? { ...d, ...updates } : d)) }));
    if (merged) void syncDrop(merged);
  }, []);

  const deleteDrop = useCallback((id: string) => {
    setState(s => ({
      ...s,
      drops: s.drops.filter(d => d.id !== id),
      // Products keep existing; they just lose their drop association.
      products: s.products.map(p => (p.dropId === id ? { ...p, dropId: undefined } : p)),
    }));
    void deleteDropRemote(id);
  }, []);

  /* ---- Journal ---- */

  const addPost = useCallback((p: JournalPost) => {
    setState(s => ({ ...s, posts: [p, ...s.posts] }));
    void syncPost(p);
  }, []);

  const updatePost = useCallback((id: string, updates: Partial<JournalPost>) => {
    const existing = stateRef.current.posts.find(p => p.id === id);
    const merged = existing ? { ...existing, ...updates } : null;
    setState(s => ({ ...s, posts: s.posts.map(p => (p.id === id ? { ...p, ...updates } : p)) }));
    if (merged) void syncPost(merged);
  }, []);

  const deletePost = useCallback((id: string) => {
    setState(s => ({ ...s, posts: s.posts.filter(p => p.id !== id) }));
    void deletePostRemote(id);
  }, []);

  /* ---- Unlock codes ---- */

  const addUnlock = useCallback((u: UnlockContent) => {
    setState(s => ({ ...s, unlocks: [u, ...s.unlocks] }));
    void syncUnlock(u);
  }, []);

  const updateUnlock = useCallback((code: string, updates: Partial<UnlockContent>) => {
    const existing = stateRef.current.unlocks.find(u => u.code === code);
    const merged = existing ? { ...existing, ...updates } : null;
    setState(s => ({
      ...s,
      unlocks: s.unlocks.map(u => (u.code === code ? { ...u, ...updates } : u)),
    }));
    if (merged) void syncUnlock(merged);
  }, []);

  const deleteUnlock = useCallback((code: string) => {
    setState(s => ({ ...s, unlocks: s.unlocks.filter(u => u.code !== code) }));
    void deleteUnlockRemote(code);
  }, []);

  /**
   * Resolve a scanned code. Supabase is asked first so the copy can be edited
   * without redeploying; the local table is the offline fallback.
   */
  const redeemUnlock = useCallback(
    async (rawCode: string): Promise<UnlockContent | null> => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return null;

      const remote = supabaseEnabled() ? await fetchUnlock(code) : null;
      const local = stateRef.current.unlocks.find(u => u.code.toUpperCase() === code && u.active);
      const found = remote ?? local ?? null;
      if (!found) return null;

      // Count the scan locally straight away, and remotely if we can.
      setState(s => ({
        ...s,
        unlocks: s.unlocks.map(u =>
          u.code.toUpperCase() === code ? { ...u, scans: u.scans + 1 } : u,
        ),
      }));
      void recordUnlockScan(code);
      return found;
    },
    [],
  );

  /* ---- Cart ---- */

  const addToCart = useCallback((item: CartItem) => {
    setState(s => {
      // Merge identical lines — same product, same size, same colour.
      const idx = s.cart.findIndex(
        c => c.productId === item.productId && c.size === item.size && c.color === item.color,
      );
      if (idx < 0) return { ...s, cart: [...s.cart, item] };

      const merged = [...s.cart];
      const existing = merged[idx];
      const quantity = existing.quantity + item.quantity;
      const product = s.products.find(p => p.id === item.productId);
      const total = product ? computeTotal(product, quantity) : existing.unitPrice * quantity;
      merged[idx] = { ...existing, quantity, total };
      return { ...s, cart: merged };
    });
  }, []);

  const updateCartQuantity = useCallback((index: number, quantity: number) => {
    setState(s => ({
      ...s,
      cart: s.cart.map((c, i) => {
        if (i !== index) return c;
        const q = Math.max(1, quantity);
        const product = s.products.find(p => p.id === c.productId);
        const total = product ? computeTotal(product, q) : c.unitPrice * q;
        return { ...c, quantity: q, total };
      }),
    }));
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setState(s => ({ ...s, cart: s.cart.filter((_, i) => i !== index) }));
  }, []);

  const clearCart = useCallback(() => {
    setState(s => ({ ...s, cart: [] }));
  }, []);

  const cartSubtotal = state.cart.reduce((sum, i) => sum + i.total, 0);
  const cartCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);

  /* ---- Orders ---- */

  const placeOrder = useCallback(
    (items: CartItem[], info: CheckoutInfo): Order => {
      const settings = stateRef.current.settings;
      const subtotal = items.reduce((sum, i) => sum + i.total, 0);
      const deliveryFee = deliveryFeeFor(subtotal, info.deliveryMethod, settings);
      const order: Order = {
        id: `GG-${Date.now().toString().slice(-6)}`,
        customerName: info.name,
        phone: info.phone,
        wilaya: info.wilaya,
        address: info.address,
        deliveryMethod: info.deliveryMethod,
        notes: info.notes,
        items,
        subtotal,
        deliveryFee,
        total: subtotal + deliveryFee,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      // Fold the buyer into the customer list, or bump their totals. Computed
      // outside setState so the same record can be synced remotely; the
      // admin's rating and note are preserved across repeat orders.
      const previous = stateRef.current.customers.find(c => c.phone === info.phone);
      const customer: Customer = previous
        ? { ...previous, orders: previous.orders + 1, totalSpent: previous.totalSpent + order.total }
        : {
            id: `c${Date.now()}`,
            name: info.name,
            phone: info.phone,
            wilaya: info.wilaya,
            orders: 1,
            totalSpent: order.total,
            joinedAt: order.createdAt,
            tag: 'unrated',
          };

      setState(s => ({
        ...s,
        orders: [order, ...s.orders],
        customers: previous
          ? s.customers.map(c => (c.phone === info.phone ? customer : c))
          : [customer, ...s.customers],
      }));

      void syncCustomer(customer);

      pushNotification({
        type: 'order',
        title: 'New order',
        body: `${info.name} — ${order.total.toLocaleString('fr-DZ')} ${settings.currency}`,
      });

      // Desktop notification for the admin, if they granted permission.
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`New order — ${settings.brandName}`, {
            body: `${info.name} — ${order.total.toLocaleString('fr-DZ')} ${settings.currency}`,
          });
        }
      } catch {
        /* unsupported browser */
      }

      void syncOrder(order);
      return order;
    },
    [pushNotification],
  );

  const updateOrderStatus = useCallback((id: string, status: Order['status']) => {
    setState(s => ({ ...s, orders: s.orders.map(o => (o.id === id ? { ...o, status } : o)) }));
    void syncOrderStatus(id, status);
  }, []);

  /* ---- Reviews ---- */

  const addReview = useCallback(
    (review: Omit<Review, 'id' | 'published' | 'createdAt'>) => {
      const full: Review = {
        ...review,
        id: `r${Date.now()}`,
        published: false,
        createdAt: new Date().toISOString(),
      };
      setState(s => ({ ...s, reviews: [full, ...s.reviews] }));
      pushNotification({
        type: 'review',
        title: 'New review awaiting approval',
        body: `${review.name} rated "${review.productName}" ${review.rating}/5`,
      });
      void syncReview(full);
    },
    [pushNotification],
  );

  const setReviewPublished = useCallback((id: string, published: boolean) => {
    setState(s => ({
      ...s,
      reviews: s.reviews.map(r => (r.id === id ? { ...r, published } : r)),
    }));
    void syncReviewPublished(id, published);
  }, []);

  const deleteReview = useCallback((id: string) => {
    setState(s => ({ ...s, reviews: s.reviews.filter(r => r.id !== id) }));
    void deleteReviewRemote(id);
  }, []);

  /* ---- Admin plumbing ---- */

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    const existing = stateRef.current.customers.find(c => c.id === id);
    const merged = existing ? { ...existing, ...updates } : null;
    setState(s => ({
      ...s,
      customers: s.customers.map(c => (c.id === id ? { ...c, ...updates } : c)),
    }));
    if (merged) void syncCustomer(merged);
  }, []);

  const ingestRemoteOrder = useCallback((order: Order) => {
    setState(s =>
      s.orders.some(o => o.id === order.id) ? s : { ...s, orders: [order, ...s.orders] },
    );
  }, []);

  const ingestRemoteReview = useCallback((review: Review) => {
    setState(s =>
      s.reviews.some(r => r.id === review.id) ? s : { ...s, reviews: [review, ...s.reviews] },
    );
  }, []);

  /**
   * Everything the dashboard needs: orders, unpublished reviews and posts,
   * unlock codes. Also seeds the remote catalog from this browser on first
   * run, so local drafts become visible to every visitor.
   */
  const loadAdminData = useCallback(async () => {
    if (!supabaseEnabled()) return;
    const { products: p, drops: d, posts: j, unlocks: u, customers: c } = stateRef.current;

    // Push before reading. Anything created while the backend was unreachable
    // — misconfigured env vars, an offline spell — exists only in this browser
    // and nothing else would ever carry it up. Upserts are keyed by id, so
    // running this on every dashboard load is idempotent and cheap.
    await pushLocalData({ products: p, drops: d, posts: j, unlocks: u, customers: c });

    const [products, orders, reviews, posts, unlocks, customers] = await Promise.all([
      fetchProducts(),
      fetchOrders(),
      fetchAllReviews(),
      fetchAllPosts(),
      fetchAllUnlocks(),
      fetchCustomers(),
    ]);
    setState(s => ({
      ...s,
      products: products && products.length > 0 ? products : s.products,
      orders: orders ?? s.orders,
      reviews: reviews ?? s.reviews,
      posts: posts && posts.length > 0 ? posts : s.posts,
      unlocks: unlocks && unlocks.length > 0 ? unlocks : s.unlocks,
      customers: customers && customers.length > 0 ? customers : s.customers,
    }));
  }, []);

  const updateSettings = useCallback((settings: StoreSettings) => {
    setState(s => ({ ...s, settings }));
    void syncSettings(settings);
  }, []);

  const login = useCallback((user: { name: string; email: string; role: string }) => {
    setState(s => ({ ...s, session: { isAuthenticated: true, user } }));
  }, []);

  const logout = useCallback(() => {
    setState(s => ({ ...s, session: { isAuthenticated: false } }));
    // Clears the stored refresh token too, so the next visit really is signed
    // out rather than restored by the mount effect above.
    void signOut();
  }, []);

  return (
    <GlowContext.Provider
      value={{
        ...state,
        addProduct,
        updateProduct,
        deleteProduct,
        addDrop,
        updateDrop,
        deleteDrop,
        addPost,
        updatePost,
        deletePost,
        addUnlock,
        updateUnlock,
        deleteUnlock,
        redeemUnlock,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartSubtotal,
        cartCount,
        placeOrder,
        updateOrderStatus,
        addReview,
        setReviewPublished,
        deleteReview,
        updateCustomer,
        ingestRemoteOrder,
        ingestRemoteReview,
        loadAdminData,
        updateSettings,
        pushNotification,
        markNotificationsRead,
        login,
        logout,
      }}
    >
      {children}
    </GlowContext.Provider>
  );
}

export function useGlowStore() {
  const ctx = useContext(GlowContext);
  if (!ctx) throw new Error('useGlowStore must be used within GlowProvider');
  return ctx;
}
