# Migrations are the single source of truth

Apply 001 through the highest number, in order, to produce a working database.
The old root-level `schema.sql` was deleted (2026-08-24): it had drifted from
these migrations and could bootstrap a broken database. For a point-in-time
snapshot use `supabase db dump`.
