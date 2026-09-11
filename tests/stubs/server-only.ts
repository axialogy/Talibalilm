/**
 * Stub for the `server-only` package under Vitest.
 *
 * The real module throws on import to stop server code reaching a Client
 * Component. That check is enforced by the bundler at build time, which is
 * where it belongs; in a Node test runner it only prevents the module from
 * being tested at all.
 */
export {};
