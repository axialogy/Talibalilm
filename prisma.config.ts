import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 reads the connection URL from here rather than from the schema.
 *
 * `DATABASE_URL` is the pooled connection the app uses at runtime — on Vercel
 * that must be Supabase's TRANSACTION pooler, because a serverless function
 * cannot hold a Postgres connection open between invocations and would
 * otherwise exhaust the database's connection slots under any real traffic.
 *
 * Migrations and `prisma db pull` need the DIRECT connection instead: the
 * transaction pooler holds no session state, so DDL and advisory locks fail
 * through it in ways that are hard to read. Point `DATABASE_URL` at the direct
 * URL for those commands (see prisma/README.md) rather than configuring a
 * second datasource, which this version no longer accepts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
