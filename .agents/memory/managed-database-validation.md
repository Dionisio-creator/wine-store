---
name: Managed database validation
description: How to handle completion checks that cannot observe Replit runtime-managed PostgreSQL bindings.
---

Treat the live managed-database check, environment-key presence, workflow status, and an actual API request as authoritative when a static reviewer claims the database binding is absent.

**Why:** A completion review twice reported a missing `DATABASE_URL` while the managed database was reachable, the runtime-managed PostgreSQL keys existed, the exact workflow was serving port 5000, and the API returned database records.

**How to apply:** Never create a duplicate local database or manually set runtime-managed PostgreSQL keys to satisfy a static check. Reconfirm the live evidence, document it, and use the supported validation override only when the mismatch is demonstrably in the reviewer.