import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, resetPasswordSchema } from '@/lib/validation/auth';

const valid = {
  fullName: 'Sihem Benali',
  email: 'Sihem@Example.FR ',
  password: 'motdepasse1',
  passwordConfirm: 'motdepasse1',
  locale: 'fr' as const,
  acceptTerms: true as const,
};

describe('registerSchema', () => {
  it('normalises the email so two casings cannot become two accounts', () => {
    const parsed = registerSchema.parse(valid);
    expect(parsed.email).toBe('sihem@example.fr');
  });

  it('rejects a password with no digit', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'motdepasse', passwordConfirm: 'motdepasse' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === 'validation.passwordWeak')).toBe(true);
  });

  it('rejects a password under eight characters', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'mdp1', passwordConfirm: 'mdp1' });
    expect(result.success).toBe(false);
  });

  it('reports a mismatch against the confirmation field, not the password', () => {
    const result = registerSchema.safeParse({ ...valid, passwordConfirm: 'autrechose1' });
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.message === 'validation.passwordMismatch');
    expect(issue?.path).toEqual(['passwordConfirm']);
  });

  it('refuses signup when the terms are not accepted', () => {
    const result = registerSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  it('has no way to set a role — that is the database trigger’s job', () => {
    const parsed = registerSchema.parse({ ...valid, role: 'admin' } as never);
    expect(parsed).not.toHaveProperty('role');
  });
});

describe('loginSchema', () => {
  it('does not enforce password rules on sign-in', () => {
    // An account created before a rule change must still be able to log in.
    expect(loginSchema.safeParse({ email: 'a@b.fr', password: 'x' }).success).toBe(true);
  });
});

describe('resetPasswordSchema', () => {
  it('applies the same strength rules as registration', () => {
    expect(resetPasswordSchema.safeParse({ password: 'court1', passwordConfirm: 'court1' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: 'motdepasse1', passwordConfirm: 'motdepasse1' }).success).toBe(true);
  });
});
