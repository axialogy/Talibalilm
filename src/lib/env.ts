import { z } from 'zod';

/**
 * Environment validation.
 *
 * Public values are inlined by Next at build time, so they must be read as
 * whole `process.env.X` expressions — destructuring or dynamic keys leave them
 * `undefined` in the browser bundle.
 *
 * Server values are validated lazily, on first access, rather than at import.
 * Validating at import would make a missing key crash the marketing pages too,
 * and those render fine without a database.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

const rawPublic = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

const parsedPublic = publicSchema.safeParse(rawPublic);

/**
 * True once the Supabase project is connected. Everything that needs a
 * database checks this first and degrades honestly instead of throwing —
 * the public catalogue has to keep rendering before the project exists.
 */
export const supabaseConfigured = parsedPublic.success;

export function publicEnv(): z.infer<typeof publicSchema> {
  if (!parsedPublic.success) {
    throw new Error(
      `Supabase is not configured. Missing or invalid: ${parsedPublic.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return parsedPublic.data;
}

let cachedServer: z.infer<typeof serverSchema> | null = null;

/** Server-only. Never import this from a Client Component. */
export function serverEnv(): z.infer<typeof serverSchema> {
  if (cachedServer) return cachedServer;
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is missing. It is server-only and must never be exposed to the browser.',
    );
  }
  cachedServer = parsed.data;
  return cachedServer;
}

/** Absolute origin for auth redirect URLs, which Supabase requires. */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Vercel injects this on preview deployments, where the URL is not known
  // ahead of time and cannot be hardcoded in the project settings.
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}
