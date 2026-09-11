import 'server-only';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma';

/**
 * Prisma, with the paywall intact.
 *
 * The default way to use Prisma is to connect as a privileged role and let the
 * application decide who may see what. That would be a mistake here. Every
 * table in this schema carries RLS policies, and 105 assertions prove things
 * like "a student who bought the fiqh module cannot read the aqida module" and
 * "nobody can grant themselves an entitlement". Connecting as an owner would
 * make all of that decorative, and move the paywall into whichever `where`
 * clause someone remembers to write.
 *
 * So there are two clients, and the distinction is the whole point:
 *
 *   `db`       — connects as the owner, bypasses RLS. For work no user
 *                performs on their own behalf: settling a verified PayPal
 *                capture, the nightly expiry sweep. Never reachable from a
 *                request whose input has not already been authorised.
 *
 *   `dbAs(id)` — runs inside a transaction that switches to the `authenticated`
 *                role and sets the request's JWT claims, exactly as Supabase's
 *                API does. `auth.uid()` returns that id, every policy applies,
 *                and a query for something the person may not see comes back
 *                empty rather than being filtered in TypeScript afterwards.
 *
 * `dbAsAnon()` is the same thing for a signed-out visitor.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Prisma needs a Postgres connection string — the ' +
        'TRANSACTION pooler on Vercel. See prisma/README.md.',
    );
  }

  // A small pool per serverless instance. The transaction pooler in front of
  // Postgres is what actually multiplexes; opening more than a couple of
  // sockets per function only moves the exhaustion one layer out.
  const adapter = new PrismaPg({ connectionString, max: 2 });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

/**
 * One client per process. Next's dev server re-evaluates modules on every
 * edit, and a fresh PrismaClient each time exhausts the database's connection
 * slots within a few saves.
 */
export const db: PrismaClient = globalForPrisma.prisma ?? client();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

/** The subset of the client available inside an RLS-scoped transaction. */
export type ScopedDb = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

/**
 * Run queries as a signed-in person, under their own policies.
 *
 * `SET LOCAL` scopes both changes to this transaction, so the connection
 * returns to the pool as itself. That matters more than it looks: a leaked
 * `SET ROLE` on a pooled connection would hand the next request someone else's
 * identity.
 *
 * The user id is passed as a bound parameter rather than interpolated. It
 * arrives from a verified session, but `set_config` taking a value that was
 * ever a string is precisely where an injection would hide.
 */
export async function dbAs<T>(userId: string, work: (tx: ScopedDb) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: userId,
      role: 'authenticated',
    })}, true)`;
    await tx.$executeRawUnsafe('set local role authenticated');
    return work(tx as unknown as ScopedDb);
  });
}

/** The same, for a visitor with no session. Sees exactly what the public sees. */
export async function dbAsAnon<T>(work: (tx: ScopedDb) => Promise<T>): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('request.jwt.claims', '', true)`;
    await tx.$executeRawUnsafe('set local role anon');
    return work(tx as unknown as ScopedDb);
  });
}
