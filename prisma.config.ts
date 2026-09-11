import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 reads CLI configuration from here rather than from the schema.
 *
 * The datasource is attached only when `DATABASE_URL` is actually set, and
 * that is load-bearing: `prisma generate` runs in `postinstall` and needs no
 * database at all — it reads the schema and writes a client. Declaring the URL
 * with Prisma's `env()` helper made it mandatory, so every deployment failed
 * during `npm install`, before the app had a chance to run.
 *
 * The application never reads the URL from here anyway. It hands an explicit
 * connection string to the driver adapter in `src/lib/db/prisma.ts`. This
 * exists for the CLI — `db pull`, `studio` — which you run with the variable
 * present.
 *
 * For `db pull` use the DIRECT connection, not the transaction pooler: the
 * pooler holds no session state, so introspection and DDL fail through it in
 * ways that are hard to read.
 *
 *     DATABASE_URL="$DIRECT_URL" npm run db:pull
 */
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(url ? { datasource: { url } } : {}),
});
