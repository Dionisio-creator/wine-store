---
name: Catalog mutation authorization
description: Security rule for administrative catalog changes
---

Catalog mutations must require a server-validated administrator session and request forgery protection; UI visibility is never an authorization boundary.

**Why:** Any visitor can bypass a browser interface and call the API directly, so client-only admin controls would allow unauthorized catalog tampering.

**How to apply:** Enforce authorization and CSRF checks on every create, update, delete, restore, and other future catalog write route, while keeping the management controls hidden until the session is authenticated.