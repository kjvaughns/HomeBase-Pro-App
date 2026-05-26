# HomeBase

HomeBase is a home services marketplace mobile app connecting homeowners with trusted service providers, with separate flows for homeowners, providers, and crew members.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/homebase run dev` — start the Expo / Metro bundler
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `SUPABASE_DATABASE_URL` — Postgres connection string (Supabase)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo 55, React Native 0.83.2, React Navigation (stack + tabs)
- API: Express 5, port 8080
- DB: PostgreSQL (Supabase) + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle for server)

## Where things live

- `artifacts/homebase/` — Expo mobile app
  - `app/` — Expo Router shell (`_layout.tsx` + `index.tsx` entry point; `index.tsx` owns React Navigation)
  - `navigation/` — React Navigation navigators (RootStack, tab navigators per role)
  - `screens/` — Screen components organised by role (`auth/`, `homeowner/`, `provider/`, `onboarding/`, `crew/`)
  - `components/` — Shared UI components
  - `hooks/` — Custom hooks (`useColors`, `useTheme`, `useAuth`, …)
  - `state/` — Zustand stores + app-review tracker
  - `lib/` — Utility helpers (query-client, apiRequest, …)
  - `constants/theme.ts` — Source-of-truth for colors, spacing, typography
  - `types/lib-compat.d.ts` — Ambient module overrides for class-component libraries (expo-blur, expo-image, expo-linear-gradient, react-native-maps, react-native-svg) to fix React 19 / @types/react v19 JSX compatibility
  - `types/react-compat.d.ts` — Module augmentation: adds `context/setState/props/state/refs` to `React.Component` interface
- `artifacts/api-server/` — Express API server
- `artifacts/shared/jobSummary.ts` — Shared type/logic imported by both homebase screens and hooks via relative `../../shared/jobSummary` paths
- `lib/` — Shared TypeScript libraries
- `scripts/` — Utility scripts

## Architecture decisions

- **React Navigation, not Expo Router routing**: `app/index.tsx` renders `<NavigationContainer>` + `<RootStackNavigator>`. Expo Router's `_layout.tsx` is just a `<Slot/>` passthrough shell. This matches the original migration source and avoids Expo Router's file-based routing constraints.
- **Ambient module declarations for React 19 JSX compatibility**: Libraries built against @types/react v18 that export class components (BlurView, Image, LinearGradient, MapView, Svg, etc.) are incompatible with @types/react v19's stricter JSX constructor checks. `types/lib-compat.d.ts` overrides each problematic module with `React.ComponentType<Props>` exports so our `.tsx` files compile cleanly.
- **`jobSummary.ts` lives at `artifacts/shared/`**: All homebase import paths for this shared type resolve to `artifacts/shared/jobSummary.ts` (two or three `../` levels up from the importing file).
- **CI=true Metro mode**: The homebase workflow runs `CI=true` so Metro starts without a file watcher (Replit's inotify limits make watching impractical). Reloads require a workflow restart.
- **DB connection**: Uses `SUPABASE_DATABASE_URL`, not the generic `DATABASE_URL`.

## Product

HomeBase connects homeowners with verified service providers. Homeowners can browse providers, request bookings, track job status, and pay invoices. Providers manage their schedule, clients, jobs, leads, and finances. Crew members have a simplified view of assigned jobs.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Support ticket inbound email threading

User email replies feed back into the ticket thread automatically via a Resend inbound webhook.

**Setup required (one-time, production):**
1. In the Resend dashboard → Domains → your domain → Inbound, point the inbound address to:
   `https://api.homebaseproapp.com/api/webhooks/resend/inbound`
2. Copy the Svix signing secret Resend provides and add it as `RESEND_WEBHOOK_SECRET` in Replit Secrets.
3. The route is registered in `artifacts/api-server/src/app.ts` before `express.json()` so the raw Buffer is available for Svix HMAC verification.
4. If `RESEND_WEBHOOK_SECRET` is absent the webhook returns `500 webhook_not_configured` and does not process the payload. Set the secret before enabling inbound routing.

**Handler:** `artifacts/api-server/src/inboundEmailHandler.ts`

## Gotchas

- **Never run `pnpm dev` at workspace root** — individual workflows handle env vars (PORT, BASE_PATH).
- **Typecheck with `tsc --noEmit`, not `build`** — `build` needs workflow-provided `PORT` and `BASE_PATH`.
- **Metro timing patches** in `node_modules/@expo/metro@55.1.1/…` are diagnostic-only, not runtime fixes.
- **`theme.backgroundRoot`**, not `theme.background` — the theme object from `useTheme()` uses `backgroundRoot`.
- **`theme.backgroundSecondary`**, not `theme.backgroundRootSecondary`.
- **After any change to `lib-compat.d.ts`** run `pnpm exec tsc --noEmit` from `artifacts/homebase/` to verify zero errors.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
