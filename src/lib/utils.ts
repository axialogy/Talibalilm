import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Capitalise the first letter, for building message keys from enum values. */
export function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
