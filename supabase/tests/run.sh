#!/usr/bin/env bash
# Run the SQL policy tests against a scratch Postgres.
#
# These check the RLS policies themselves, which is the one layer Playwright
# cannot reach: a Playwright test proves the app does not leak, while these
# prove the database would refuse even if the app did.
#
# Each test file gets its OWN database. They are independent by construction,
# so fixtures cannot collide and one file's writes cannot make another's
# assertions pass or fail by accident.
#
# Needs a reachable Postgres 15+. Point PGHOST/PGPORT/PGUSER at it, or let the
# defaults find a local socket. `supabase start` also works — use its port.
set -euo pipefail

PGHOST="${PGHOST:-/var/lib/postgresql/run}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-postgres}"
export PGHOST PGPORT PGUSER

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
status=0

for test in "$root"/supabase/tests/rls_*.sql; do
  name="$(basename "$test" .sql)"
  db="talibalim_${name}"

  psql -tAc "drop database if exists ${db};" >/dev/null
  psql -tAc "create database ${db};" >/dev/null

  # The harness stands in for the auth schema Supabase provides. It is never
  # applied to a real project.
  psql -d "$db" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/00_local_harness.sql"

  for migration in "$root"/supabase/migrations/*.sql; do
    psql -d "$db" -v ON_ERROR_STOP=1 -q -f "$migration"
  done

  echo "── ${name}.sql"
  if ! psql -d "$db" -v ON_ERROR_STOP=1 -q -f "$test" 2>&1 | sed 's/^psql:[^ ]* //; s/^NOTICE:  //'; then
    status=1
  fi

  psql -tAc "drop database if exists ${db};" >/dev/null
done

exit $status
