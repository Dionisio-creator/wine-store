---
name: Preview and live catalog
description: Why preview edits must not silently overwrite the live catalog during publishing.
---

Keep preview and production databases isolated. Publishing code is not a workflow for copying edited catalog data. Direct live catalog administration to the admin on the verified published domain.

**Why:** The creator uploaded wine images through the preview admin and expected republishing to make them visible to visitors. Development had images while production had none. Automatically overwriting the live catalog or sharing production credentials with the preview risks losing live edits during development.

**How to apply:** Explain which environment an admin is editing. Recover preview photos through an explicit authenticated, confirmed import that fills only missing images and preserves live prices, descriptions, and existing photos. Do not add startup-time bulk data copies or reset production on republish.
