# KOSHELI — Backend

This folder contains the backend scaffold for the KOSHELI project (Express + Mongoose).

Run locally:

```bash
cd backend
npm install
cp .env.sample .env
# update .env if needed
npm run dev
```

Key files:
- `server.js` — application entry
- `config/db.js` — DB connection
- `routes/` & `controllers/` — API skeleton
- `models/` — Mongoose schemas
