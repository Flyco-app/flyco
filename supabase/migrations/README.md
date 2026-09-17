# Migrations

No product schema migrations exist yet. docs/schema.sql is a non-deployed design reference.

Create the first reviewed feature migration with `pnpm exec supabase migration new <name>`, after inspecting CLI help. Add RLS, column grants, transaction guards and database tests with each vertical slice. Never apply the entire design reference to a shared database. Use `pnpm db:reset` only against the local stack; the script explicitly selects --local.
