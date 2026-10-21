# WAYPOINT AI

A road-safety dashboard prototype: report road hazards, see them on a live map, check weather-based travel risk, and prepare civic complaint drafts with a small tool-using agent.

Built with React 18, Vite 7, TypeScript, Tailwind CSS, Leaflet/OpenStreetMap, Open-Meteo, and optional Supabase storage.

> **Prototype status:** this is a frontend-only demo. See [Limitations](#limitations) before relying on it for anything real.

## Features

- **Dashboard:** stats, map preview, local weather and an estimated travel-risk score
- **Live map:** filter hazards by category, severity and status; "my location" support
- **Report a hazard:** keyword-based category/severity suggestion, photo upload (auto-resized), pick the location by clicking the map, searching a place, or using GPS
- **Agent:** a rule-based agent that picks tools (classify, find nearby/similar reports, weather, authority lookup, complaint drafting, next steps)
- **Complaints:** review, edit, approve and copy drafts (nothing is ever sent automatically)
- Light/dark theme, works without any backend

## Quick start

**Requirements:** [Node.js](https://nodejs.org) 20.19+ or 22.12+ (Vite 7 needs this) and npm. Check with `node -v`.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). That's it. With no configuration, reports are stored in your browser (localStorage) and a few sample reports are created on first load.

### Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run check` | typecheck + lint + build (what CI runs) |

## Optional: use Supabase instead of localStorage

Local mode is per-browser. Use Supabase if you want data shared across devices.

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of `supabase/migrations/20261021040228_create_reports_schema.sql`, and run it.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon / publishable** key.
4. Copy `.env.example` to `.env` and fill in the two values:
   ```
   VITE_SUPABASE_URL=https://abcdxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```
5. Restart `npm run dev`. The sidebar badge changes from "Local demo mode" to "Supabase connected".

**Security notes**

- Only ever use the public anon/publishable key. **Never** put a `service_role` key in `.env`: every `VITE_` variable is bundled into the public website.
- The anon key is safe to be public *because* of Row Level Security, but the included policies are intentionally open for a shared demo: anyone with the key can read, create, edit and delete reports. History and agent logs are append-only. Do not store private data until you add Supabase Auth and ownership-based policies.
- `.env` is git-ignored. Don't commit it.

## Put it on GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

Create an **empty** repository on github.com (no README/license/.gitignore, since the project already has them), then:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Before pushing, run `git status` and confirm that `.env`, `node_modules/` and `dist/` are **not** listed (they're in `.gitignore`).

### Optional: free hosting with GitHub Pages

The repo includes workflows in `.github/workflows/`:

- `ci.yml` runs typecheck, lint and build on every push and pull request.
- `deploy.yml` publishes the site to GitHub Pages on every push to `main`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Your site will be at `https://<your-username>.github.io/<your-repo>/`.

To use Supabase on the hosted site, add two repository secrets under **Settings → Secrets and variables → Actions**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without them the hosted site runs in local demo mode.

## Project layout

```
src/
  components/   AppShell, HazardMap (Leaflet), ui/ (badges, toasts)
  hooks/        useReports (data provider), useTheme
  lib/          constants, supabase client, image resizing, uuid helper
  pages/        Dashboard, LiveMap, ReportForm, ReportDetails, Agent, Complaints, Weather
  services/     storage (localStorage or Supabase), agent, classifier, weather, seed
  types/        shared TypeScript types
supabase/migrations/   database schema + row level security
```

## Limitations

- **No real AI/LLM.** The "agent" and "classifier" are deterministic keyword/rule-based logic running in the browser. Uploaded photos are not analysed.
- **No backend or authentication.** There is no server-side validation, rate limiting or user accounts.
- **Complaints are drafts only.** Nothing is submitted to any authority. The authority directory is a generic, **unverified** list; verify contacts before using them.
- **Risk score is an estimate** based on current weather plus nearby open reports. It is not a certified safety prediction.
- **Photos** are resized and stored as data URLs (in localStorage, or in the database column in Supabase mode). Fine for a demo, not for production; use object storage for that.
- OpenStreetMap tiles and Nominatim geocoding are public services with usage policies. Avoid high-volume use.
- `npm audit` may report an advisory in `react-router` about SSR hydration. This app is client-only (HashRouter) and does not use that code path.

## Troubleshooting

- **`npm install` or `npm run dev` errors about Node version:** upgrade to Node 20.19+/22.12+.
- **Blank list / "Could not load reports" with Supabase:** the SQL migration wasn't run, or the URL/key in `.env` is wrong. Restart the dev server after editing `.env`.
- **Want to reset local demo data:** in browser DevTools → Application → Local Storage, delete the keys starting with `waypoint.`, then reload.
- **Location button does nothing:** the browser blocked location access. Allow it in the site permissions. Geolocation also needs `https://` or `localhost`.
- **Map shows grey tiles:** check your internet connection; tiles load from openstreetmap.org.
