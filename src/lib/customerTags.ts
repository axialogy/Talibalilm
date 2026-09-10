import type { CustomerTag } from '@/types';
import type { TranslationKey } from '@/i18n/en';

const KEYS: Record<CustomerTag, TranslationKey> = {
  unrated: 'tagUnrated',
  good: 'tagGood',
  regular: 'tagRegular',
  risky: 'tagRisky',
  blocked: 'tagBlocked',
};

/** Pill colour per rating — blocked has to read as a stop sign. */
const TONES: Record<CustomerTag, 'neutral' | 'warn' | 'info' | 'good' | 'bad'> = {
  unrated: 'neutral',
  good: 'good',
  regular: 'info',
  risky: 'warn',
  blocked: 'bad',
};

export function tagKey(tag: CustomerTag | undefined): TranslationKey {
  return KEYS[tag ?? 'unrated'] ?? 'tagUnrated';
}

export function tagTone(tag: CustomerTag | undefined) {
  return TONES[tag ?? 'unrated'] ?? 'neutral';
}
