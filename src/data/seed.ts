import type {
  Product, Drop, JournalPost, UnlockContent, Review, Order, Customer,
} from '@/types';

/**
 * Starting state for a fresh store.
 *
 * Deliberately empty. The shop is filled from the dashboard, and everything
 * created there syncs to Supabase — so these arrays are only the fallback for
 * a browser that has never loaded remote data.
 *
 * The demo catalogue that used to live here (eight products, two drops, four
 * journal notes, sample orders and reviews) was removed at handover so the
 * client never sees placeholder data under their own brand. It is still in
 * git history if any of it is ever wanted as a reference.
 */

export const seedProducts: Product[] = [];

export const seedDrops: Drop[] = [];

export const seedPosts: JournalPost[] = [];

export const seedUnlocks: UnlockContent[] = [];

export const seedReviews: Review[] = [];

export const seedOrders: Order[] = [];

export const seedCustomers: Customer[] = [];
