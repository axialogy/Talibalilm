import { z } from 'zod';

/**
 * Auth schemas, shared by the form and the server action.
 *
 * One definition, both sides: the client gets instant feedback, the server
 * re-validates the same rules on data it never trusts. Messages are message
 * *keys*, not sentences — the form resolves them through next-intl so the
 * errors are localised without duplicating the schema per locale.
 */
export const emailSchema = z
  .string()
  .min(1, 'validation.required')
  // Normalise before validating, not after. Mobile keyboards and password
  // managers routinely append a space, and validating first rejects that as a
  // malformed address. Lowercasing here is also what stops `A@b.fr` and
  // `a@b.fr` becoming two accounts.
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.string().max(254).email('validation.emailInvalid'));

export const passwordSchema = z
  .string()
  .min(8, 'validation.passwordShort')
  // Deliberately mild: length carries far more entropy than a symbol quota,
  // and aggressive composition rules push people toward "Password1!".
  .max(72, 'validation.passwordShort')
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'validation.passwordWeak');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'validation.required'),
  next: z.string().optional(),
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'validation.nameShort')
      .max(120, 'validation.nameShort')
      .transform((v) => v.trim()),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    locale: z.enum(['fr', 'ar']).default('fr'),
    acceptTerms: z.literal(true, { message: 'validation.termsRequired' }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirm'],
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const magicLinkSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'validation.passwordMismatch',
    path: ['passwordConfirm'],
  });

export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
