import { afterAll, describe, expect, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma';

/**
 * Does Prisma actually respect the policies?
 *
 * This is the test the whole Prisma decision rests on. Prisma's ordinary mode
 * is to connect as an owner and let application code decide who sees what —
 * which would make every policy in this schema decorative and move the paywall
 * into whichever `where` clause someone remembers. `dbAs` is supposed to
 * prevent that by switching role and setting the JWT claims per transaction,
 * exactly as Supabase's own API does.
 *
 * "Supposed to" is not good enough for a paywall, so this runs against real
 * Postgres with the real migrations and the real policies.
 *
 * The role it connects as carries BYPASSRLS, because that is what Supabase's
 * `postgres` role carries and therefore what Prisma will really be. So these
 * assertions are not "RLS works" — they are "RLS still works from a connection
 * that could see everything", which is the only version worth testing.
 *
 * Skipped when no database is reachable. It must never be made to pass by
 * loosening a policy.
 */
// Prisma 7 takes the connection from DATABASE_URL; there is no constructor
// option for it any more.
const url = process.env.DATABASE_URL;
const BUYER = 'b0000000-0000-4000-8000-000000000001';
const NOBODY = 'b0000000-0000-4000-8000-000000000002';
const FIQH_LESSON = 'e1000000-0000-4000-8000-000000000001';
const AQIDA_LESSON = 'e1000000-0000-4000-8000-000000000002';

const suite = url ? describe : describe.skip;

const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : null;

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

async function asUser<T>(userId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('request.jwt.claims', ${JSON.stringify({
      sub: userId,
      role: 'authenticated',
    })}, true)`;
    await tx.$executeRawUnsafe('set local role authenticated');
    return work(tx);
  });
}

async function asAnon<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`select set_config('request.jwt.claims', '', true)`;
    await tx.$executeRawUnsafe('set local role anon');
    return work(tx);
  });
}

afterAll(async () => {
  await prisma?.$disconnect();
});

suite('Prisma under RLS', () => {
  it('opens the module the person bought', async () => {
    const rows = await asUser(BUYER, (tx) =>
      tx.lesson_content.findMany({ where: { lesson_id: FIQH_LESSON } }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.video_id).toBe('SECRET-FIQH');
  });

  it('refuses the module they did NOT buy, through Prisma', async () => {
    // The point of the whole exercise. Prisma asked for the row by primary
    // key; the database returned nothing.
    const rows = await asUser(BUYER, (tx) =>
      tx.lesson_content.findMany({ where: { lesson_id: AQIDA_LESSON } }),
    );
    expect(rows).toEqual([]);
  });

  it('refuses a findMany with no filter just the same', async () => {
    // A missing `where` is the classic way an ORM leaks. Here it cannot: the
    // filtering happens below Prisma.
    const rows = await asUser(BUYER, (tx) => tx.lesson_content.findMany());
    expect(rows.map((r: { lesson_id: string }) => r.lesson_id)).toEqual([FIQH_LESSON]);
  });

  it('shows a signed-in account with nothing bought no gated content at all', async () => {
    const rows = await asUser(NOBODY, (tx) => tx.lesson_content.findMany());
    expect(rows).toEqual([]);
  });

  it('shows an anonymous visitor the catalogue but no gated content', async () => {
    const [courses, content] = await asAnon(async (tx) => [
      await tx.courses.findMany(),
      await tx.lesson_content.findMany(),
    ]);
    expect(courses).toHaveLength(2);
    expect(content).toEqual([]);
  });

  it('cannot be talked into granting an entitlement', async () => {
    await expect(
      asUser(NOBODY, (tx) =>
        tx.entitlements.create({
          data: {
            user_id: NOBODY,
            scope: 'site',
            expires_at: new Date(Date.now() + 86_400_000),
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('cannot read anyone else’s profile', async () => {
    const rows = await asUser(BUYER, (tx) => tx.profiles.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(BUYER);
  });

  it('leaves the connection as itself afterwards', async () => {
    // SET LOCAL is scoped to the transaction. If it leaked, the next request
    // on this pooled connection would inherit someone else's identity — which
    // is a worse bug than anything RLS protects against.
    await asUser(BUYER, async (tx) => tx.$executeRawUnsafe('select 1'));
    const rows = await prisma!.$queryRawUnsafe<{ current_role: string }[]>(
      'select current_user as current_role',
    );
    expect(rows[0]?.current_role).toBe('prisma_app');
  });

  it('still bypasses RLS on the unscoped client, as the webhook path needs', async () => {
    // `db` is the owner connection. It must see everything — that is what
    // settles a verified PayPal capture — which is exactly why it is never
    // reachable from unvalidated input.
    const rows = await prisma!.lesson_content.findMany();
    expect(rows.length).toBe(2);
  });
});
