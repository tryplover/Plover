# Bolt's Performance Journal

## 2025-05-14 - Database Performance Anti-pattern
**Learning:** Repository classes in this codebase (like `TasksRepo` and `GoalsRepo`) were preparing SQL statements on every method call. In `better-sqlite3`, `db.prepare()` is an expensive operation that parses and compiles SQL. Additionally, the high-volume `activity` table lacked indexes on frequently queried columns (`ts`, `kind`).
**Action:** Always check repository classes for inline `db.prepare()` calls and move them to the constructor. Ensure high-volume tables have indexes on columns used for filtering and sorting in migrations.
