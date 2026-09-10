/** Facts about the school that are not translated: an address is an address. */
export const institut = {
  addressLines: ['Locaux de la Mosquée El Mominine', '77130 Montereau-Fault-Yonne'],
  phone: '07 56 85 79 64',
  email: 'talibalim77@gmail.com',
  social: {
    facebook: 'https://facebook.com/',
    instagram: 'https://instagram.com/',
    tiktok: 'https://tiktok.com/',
    youtube: 'https://youtube.com/',
  },
  /** Annual membership, in cents. Moves to `membership_plans` in Phase 3. */
  annualPriceCents: 30000,
  currency: 'EUR',
} as const;
