# Replit setup

## Run the app

The project runs with Node.js, Express, and PostgreSQL.

- The `Start application` workflow runs `PORT=5000 npm start`.
- The app is served through the Replit web preview.
- The managed PostgreSQL database is exposed through `DATABASE_URL`.
- On first startup, the server creates the `vinhos` table and seeds the 20-item catalog when the table is empty.

For a one-off shell run:

```bash
PORT=5000 npm start
```

The main API is available at `/api/vinhos`.