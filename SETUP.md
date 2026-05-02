# SayIt — Setup Guide

## Prerequisites
- Node.js LTS (nodejs.org)
- Supabase account (supabase.com) — free tier is fine

---

## Step 1 — Install dependencies
```bash
cd sayit
npm install
```

## Step 2 — Add your Supabase credentials
```bash
cp .env.local.example .env.local
```
Open `.env.local` and paste your values from **Supabase → Settings → API**:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## Step 3 — Run the database schema
In **Supabase Dashboard → SQL Editor → New Query**, paste the contents of `supabase-schema.sql` and click **Run**.

## Step 4 — Enable Google Auth (optional for now)
In Supabase → **Authentication → Providers → Google**, toggle it on and add your Google OAuth credentials.

## Step 5 — Run the app
```bash
npm run dev
```
Open **http://localhost:3000** in your browser (or on your phone via your local network IP).

## Step 6 — Deploy to Vercel (free)
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → import your repo
3. Add your two env vars (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY)
4. Deploy — you get a live HTTPS URL instantly

---

## Screens built so far
| Screen | Path |
|--------|------|
| Login | /login |
| Register | /register |
| Home | /home |
| Category (Romance, Birthday, etc.) | /category/[slug] |
| Card detail + page-turn | /card/[id] |
| Send flow | /send |
| History + reactions | /history |
| Saved wishes | /wishes |
| Web preview (for SMS recipients) | /preview/[code] |
