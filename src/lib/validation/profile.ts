import { z } from 'zod';

/**
 * The student's enrolment details.
 *
 * Shared by the checkout form and the server action, like the auth schemas:
 * the client pass is a courtesy, the server pass is the one that counts.
 * Messages are keys resolved through next-intl, never sentences.
 */

/**
 * The department a student enrols in. One today; a value rather than a free
 * field so the office can group by it, and a list rather than an enum so a
 * second department costs a constant, not a migration.
 */
export const DEPARTMENTS = ['sciences-islamiques'] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const CIVILITIES = ['madame', 'monsieur'] as const;
export type Civility = (typeof CIVILITIES)[number];

/** Digits, spaces and the punctuation French numbers are written with. */
const PHONE = /^\+?[0-9][0-9 ().-]{5,30}$/;

export const profileDetailsSchema = z.object({
  civility: z.enum(CIVILITIES, { message: 'validation.civilityRequired' }),
  firstName: z
    .string()
    .trim()
    .min(2, 'validation.nameShort')
    .max(60, 'validation.tooLong'),
  lastName: z
    .string()
    .trim()
    .min(2, 'validation.nameShort')
    .max(60, 'validation.tooLong'),
  phone: z.string().trim().regex(PHONE, 'validation.phoneInvalid'),
  // Optional, and an empty string is the absence of a landline rather than a
  // malformed one.
  phoneLandline: z
    .string()
    .trim()
    .refine((value) => value === '' || PHONE.test(value), 'validation.phoneInvalid'),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.dateInvalid')
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return false;
      // Same year/month/day, or the date rolled over (2026-02-31 became March).
      if (date.toISOString().slice(0, 10) !== value) return false;
      const now = new Date();
      return date <= now && date >= new Date('1900-01-01T00:00:00Z');
    }, 'validation.dateInvalid'),
  address: z
    .string()
    .trim()
    .min(5, 'validation.addressShort')
    .max(200, 'validation.tooLong'),
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z][0-9A-Za-z -]{2,15}$/, 'validation.postalInvalid'),
  city: z
    .string()
    .trim()
    .min(2, 'validation.cityShort')
    .max(120, 'validation.tooLong'),
  department: z.enum(DEPARTMENTS, { message: 'validation.departmentRequired' }),
});

export type ProfileDetails = z.infer<typeof profileDetailsSchema>;
