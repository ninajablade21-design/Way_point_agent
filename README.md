# WAYPOINT AI

Road-safety dashboard prototype built with React, Vite, TypeScript, Leaflet/OpenStreetMap, Open-Meteo, and optional Supabase storage.

## Requirements
- Node.js 20.19+ or 22.12+ (Vite 7 requirement)
- npm

## Run on Windows (PowerShell)
1. Extract the ZIP and open this folder in VS Code.
2. Install dependencies: `npm install`
3. Start the frontend: `npm run dev`
4. Open the local URL printed by Vite.

## Checks
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## Optional Supabase
Create a `.env` file with the public browser values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Apply the SQL migration in `supabase/migrations/` before enabling Supabase. Never put a service-role key in Vite variables or frontend code. The included migration intentionally enables shared demo access to reports; do not use that policy for private production data without redesigning RLS and adding authenticated ownership checks.

## Scope and limitations
This ZIP currently contains a **frontend-only prototype**. The rule-based agent tools execute in the browser, not in a Node/Express backend. It does not yet include backend REST routes, Supabase Auth UI, server-side input validation/rate limiting, a configured authority verification service, or a genuine LLM. The agent is explicitly rule-based. Local demo reports are stored in browser localStorage. Weather is fetched from Open-Meteo when a location is available.

OpenStreetMap tiles and Nominatim geocoding are public services; respect their usage policies.
