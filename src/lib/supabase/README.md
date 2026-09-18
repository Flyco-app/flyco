# Supabase request boundary

`server.ts` creates a request-scoped `@supabase/ssr` client using the publishable key and the user's HttpOnly cookies. It is used only in server components, server actions and the Auth callback. `src/proxy.ts` refreshes sessions, forwards updated request cookies and sets response cookies. Authorization always uses a fresh `getUser()` result plus RLS; no service-role client is imported into application code. Local synthetic integration/E2E tests obtain a local-only secret key from `supabase status` for fixture creation and cleanup.

The first verified request creates `profiles` using the member JWT and the self-insert policy. Do not add a privileged trigger or expose private account fields to work around RLS errors. If a future server component needs a read-only cookie adapter, keep it separate from the writable action/route adapter and verify refresh behavior in tests.
