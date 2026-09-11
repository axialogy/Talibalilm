#!/usr/bin/env bash
# Provision the database the Prisma RLS tests run against.
#
# It is built from the real migrations and given a login role that carries
# BYPASSRLS — because that is what Supabase's `postgres` role carries, and
# therefore what Prisma will really be in production. Testing against a
# role that cannot bypass RLS would prove nothing about the thing that
# actually matters: whether `dbAs()` constrains a connection that could
# otherwise see everything.
#
#   ./scripts/test-db.sh          # provision, print the DATABASE_URL
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGHOST="${PGHOST:-/var/lib/postgresql/run}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-postgres}"
DB="${TEST_DB:-talibalim_prisma_test}"
APP_ROLE="${TEST_ROLE:-prisma_app}"
APP_PASS="${TEST_ROLE_PASSWORD:-localonly}"
export PGHOST PGPORT PGUSER

psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$here/supabase/tests/00_local_harness.sql"

"$here/supabase/bundle.sh" | psql -q -d "$DB" -v ON_ERROR_STOP=1 --single-transaction -f -

psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$here/supabase/tests/prisma_fixtures.sql"

psql -q -d "$DB" -v ON_ERROR_STOP=1 <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = '$APP_ROLE') then
    create role $APP_ROLE login password '$APP_PASS';
  end if;
end \$\$;
alter role $APP_ROLE bypassrls;
grant anon, authenticated, service_role to $APP_ROLE;
grant usage on schema public, auth to $APP_ROLE;
SQL

echo "postgresql://$APP_ROLE:$APP_PASS@localhost:$PGPORT/$DB?schema=public"
