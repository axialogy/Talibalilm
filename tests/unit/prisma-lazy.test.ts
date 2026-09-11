import { describe, expect, it } from 'vitest';

/**
 * `next build` imports every module it can reach, and Vercel builds without
 * DATABASE_URL. A client constructed at module load would fail the build the
 * moment any page imported it — with an error about a connection string
 * rather than about the import that caused it.
 */
describe('the Prisma module', () => {
  it('imports without a database configured', async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const mod = await import('../../src/lib/db/prisma');
      expect(typeof mod.dbAs).toBe('function');
      expect(mod.db).toBeDefined();
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });

  it('complains only when a query is actually made', async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const { db } = await import('../../src/lib/db/prisma');
      expect(() => db.profiles).toThrow(/DATABASE_URL/);
    } finally {
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });
});
