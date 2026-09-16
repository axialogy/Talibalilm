import { describe, expect, it } from 'vitest';
import { profileDetailsSchema } from '@/lib/validation/profile';

/**
 * The checkout's enrolment details.
 *
 * The form is a courtesy; this schema is what the server action trusts. These
 * tests pin the rules that would otherwise be discovered by a student whose
 * enrolment silently failed to save.
 */

const valid = {
  civility: 'madame',
  firstName: 'Amina',
  lastName: 'B.',
  phone: '0699193552',
  phoneLandline: '0134567890',
  birthDate: '1995-10-03',
  address: '12 rue de la Mosquée',
  postalCode: '77130',
  city: 'Montereau-Fault-Yonne',
  department: 'sciences-islamiques',
};

describe('profileDetailsSchema', () => {
  it('accepts a complete enrolment', () => {
    const parsed = profileDetailsSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.firstName).toBe('Amina');
      expect(parsed.data.department).toBe('sciences-islamiques');
    }
  });

  it('trims names and addresses rather than storing the padding', () => {
    const parsed = profileDetailsSchema.safeParse({
      ...valid,
      firstName: '  Youcef  ',
      city: '  Paris ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.firstName).toBe('Youcef');
      expect(parsed.data.city).toBe('Paris');
    }
  });

  it('requires a civility the database constraint will accept', () => {
    const parsed = profileDetailsSchema.safeParse({ ...valid, civility: 'docteur' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe('validation.civilityRequired');
    }
  });

  it('requires a department from the known list', () => {
    const parsed = profileDetailsSchema.safeParse({ ...valid, department: 'informatique' });
    expect(parsed.success).toBe(false);
  });

  it('accepts an empty landline but not a malformed one', () => {
    expect(profileDetailsSchema.safeParse({ ...valid, phoneLandline: '' }).success).toBe(true);
    expect(profileDetailsSchema.safeParse({ ...valid, phoneLandline: 'pas-un-numero' }).success).toBe(
      false,
    );
  });

  it('rejects a phone number with letters', () => {
    expect(profileDetailsSchema.safeParse({ ...valid, phone: '06AB123456' }).success).toBe(false);
  });

  it('rejects a date that does not exist', () => {
    // The Date constructor would roll 2026-02-31 to March; the schema checks
    // the string round-trips, so a typo cannot become a birthday.
    expect(profileDetailsSchema.safeParse({ ...valid, birthDate: '2026-02-31' }).success).toBe(false);
  });

  it('rejects a birth date in the future', () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expect(
      profileDetailsSchema.safeParse({ ...valid, birthDate: nextYear.toISOString().slice(0, 10) })
        .success,
    ).toBe(false);
  });

  it('rejects a postal code the column constraint would refuse', () => {
    expect(profileDetailsSchema.safeParse({ ...valid, postalCode: '!!' }).success).toBe(false);
  });
});
