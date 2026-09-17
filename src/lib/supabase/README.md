# Supabase boundary

No client is instantiated until the auth phase. Use `@supabase/ssr` with a request-scoped cookie adapter and publishable key. Verify claims/user server-side. User requests retain their JWT and RLS; never substitute an administrative client. Split writable cookie adapters (proxy/route handlers/actions) from read-only Server Components; do not silently catch cookie-write errors.

Generate `database.types.ts` from local migrations using `pnpm db:types` when the first schema slice lands. There is deliberately no hand-written fake generated type and no service-role client. See docs/auth.md and docs/database.md.
