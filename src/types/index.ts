/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

/** Bundle pricing, e.g. 1 tee = 3200 DZD, 2 tees = 5800 DZD. */
export interface PriceTier {
  /** How many units the bundle covers */
  qty: number;
  /** Total price in DZD for the whole bundle */
  price: number;
}

export type ProductCategory = 'tee' | 'hoodie' | 'crewneck' | 'cap' | 'accessory';

export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'ONE SIZE';

export interface ColorOption {
  /** Display name, e.g. "Lavender Haze" */
  name: string;
  /** Swatch hex */
  hex: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** Short line shown under the name on cards */
  tagline?: string;
  description: string;
  category: ProductCategory;
  /** The collection / drop this piece belongs to */
  dropId?: string;
  /** Fabric and construction, e.g. "240gsm brushed cotton fleece" */
  material: string;
  sizes: Size[];
  colors: ColorOption[];
  /** Current selling price per unit, in DZD */
  price: number;
  /** Previous price (DZD). When higher than `price`, a discount badge shows. */
  oldPrice?: number;
  /** Optional bundle offers */
  offers?: PriceTier[];
  images: string[];

  /* ---- Brand signature fields ---- */
  /**
   * The message printed in reverse on the garment. Readable only in a
   * mirror — the core product idea from the brand book.
   */
  mirrorMessage?: string;
  /** Where the reverse print sits, e.g. "front chest", "back yoke" */
  mirrorPlacement?: string;
  /**
   * Code stitched into the care label as a hidden QR. Scanning it opens
   * /unlock/<code> with content tied to this piece.
   */
  unlockCode?: string;

  features: string[];
  /** Out of stock hides the add-to-cart button but keeps the page live */
  inStock: boolean;
  /** Surfaced in the "new in" rail on the home page */
  featured?: boolean;
}

/** A seasonal collection. The brand ships in drops, not permanent lines. */
export interface Drop {
  id: string;
  slug: string;
  name: string;
  /** One-line theme, e.g. "for the nights you almost gave up" */
  statement: string;
  description: string;
  coverImage?: string;
  /** ISO date the drop went (or goes) live */
  releasedAt: string;
  published: boolean;
}

/* ------------------------------------------------------------------ */
/* Cart & orders                                                       */
/* ------------------------------------------------------------------ */

export interface CartItem {
  productId: string;
  productName: string;
  slug: string;
  quantity: number;
  size: Size;
  color: string;
  /** Unit price in DZD at the moment the item was added */
  unitPrice: number;
  /** Line total in DZD, after any bundle offer */
  total: number;
  image?: string;
}

export interface CheckoutInfo {
  name: string;
  phone: string;
  wilaya: string;
  address: string;
  /** Home delivery costs more than picking up at the carrier's desk */
  deliveryMethod: 'home' | 'desk';
  notes?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  customerName: string;
  phone?: string;
  wilaya?: string;
  address?: string;
  deliveryMethod?: 'home' | 'desk';
  notes?: string;
  items: CartItem[];
  /** Goods total, before delivery */
  subtotal: number;
  deliveryFee: number;
  /** subtotal + deliveryFee */
  total: number;
  status: OrderStatus;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Community                                                           */
/* ------------------------------------------------------------------ */

export interface Review {
  id: string;
  productId: string;
  productName: string;
  name: string;
  rating: number; // 1..5
  comment: string;
  published: boolean;
  createdAt: string;
}

/**
 * A journal entry. This is the "light emotional support" pillar — short,
 * non-clinical, written like a friend. Never advice, never diagnosis.
 */
export interface JournalPost {
  id: string;
  slug: string;
  title: string;
  /** Two or three lines shown on the card */
  excerpt: string;
  body: string;
  /** e.g. "overthinking", "self-doubt", "starting over" */
  tag: string;
  readMinutes: number;
  coverImage?: string;
  published: boolean;
  createdAt: string;
}

/**
 * What a hidden QR code opens. One row per code; the code itself is
 * printed on the garment's care label.
 */
export interface UnlockContent {
  /** The code in the QR, e.g. "SOFT-01" */
  code: string;
  /** Piece this code shipped on */
  productName: string;
  /** The line that greets whoever scanned it */
  message: string;
  /** Longer note under the message */
  body: string;
  /** Optional playlist / community link */
  linkUrl?: string;
  linkLabel?: string;
  /** How many times it has been scanned — shown in the admin dashboard */
  scans: number;
  active: boolean;
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

/**
 * How the shop rates a buyer. Cash on delivery means a refused parcel costs
 * real money, so knowing who to stop shipping to matters.
 */
export type CustomerTag = 'unrated' | 'good' | 'regular' | 'risky' | 'blocked';

export const CUSTOMER_TAGS: CustomerTag[] = ['unrated', 'good', 'regular', 'risky', 'blocked'];

export interface Customer {
  id: string;
  name: string;
  phone: string;
  wilaya?: string;
  orders: number;
  totalSpent: number;
  joinedAt: string;
  tag?: CustomerTag;
  /** Free-text note only the admin sees */
  note?: string;
}

export interface AppNotification {
  id: string;
  type: 'order' | 'review' | 'unlock';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface AppSession {
  isAuthenticated: boolean;
  user?: { name: string; email: string; role: string };
}

export interface StoreSettings {
  brandName: string;
  brandColor: string;
  tagline: string;
  email: string;
  phone: string;
  instagram: string;
  tiktok: string;
  address: string;
  currency: string;
  /** Delivery pricing, in DZD */
  deliveryHome: number;
  deliveryDesk: number;
  /** Cart total above which delivery is free. 0 disables the rule. */
  freeDeliveryOver: number;
  /** Shown in the announcement bar; empty hides the bar */
  announcement: string;
}
