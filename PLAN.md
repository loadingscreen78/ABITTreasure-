# PLAN — ABIT Tech Treasure Hunt

Mobile-first QR checkpoint app for ~40 teams on campus phones. Next.js 16 (App Router) on
**Cloudflare Workers (free plan)** via OpenNext, **Supabase** Postgres + Auth.

## Phases
1. Scaffold — Next 16 + TS strict + Tailwind v4, Supabase clients, `lib/env.ts`, ESLint/Prettier, Vitest, Playwright, `check-design`, secret-leak check, CI.
2. SQL migrations (tables, RLS on with no policies, RPC functions), content seed, content-integrity tests, RLS lockdown test.
3. Game engine (pure): normalise/match, state machine, scoring, time bonus + unit tests.
4. Team auth (jose cookie), bcrypt, DB throttling, route handlers, SQL integration tests (PGlite).
5. Design system "Field Dossier" + `/dev/kit`.
6. Team screens, motion, haptics, reduced motion, retry logic.
7. Admin, judge, board.
8. Printables + QR + print QA.
9. E2E, load test, visual QA, Lighthouse, bundle-leak check.
10. README, runbook, deploy, summary.

## Key decisions (and deviations from the prompt)
| Decision | Why |
|---|---|
| Host on **Cloudflare Workers free plan** (not Vercel) | Organiser request. |
| Every page is **prerendered static**; all live data comes from small JSON route handlers | Free plan = 10 ms CPU/request. A static shell + one DB round-trip per action stays well under it. `/s/:token` is rewritten to the static `/scan` shell, which POSTs the token. |
| **Edge `middleware.ts`** instead of Next 16 `proxy.ts` | OpenNext marks Node-runtime `proxy.ts` as experimental on Workers; edge middleware is fully supported. Matcher is `/admin`, `/judge`, `/print` only. |
| **bcrypt cost 5** (`BCRYPT_COST`) | Keeps a login inside the free-plan CPU budget. 7-char random passwords + DB rate limit + hashes unreadable without the secret key. Use 10 on Workers Paid. |
| **Judge uses Supabase Auth** (email + password, role `judge`), not a PIN | Section 7A requires organiser auth via `getClaims()`. |
| Passwords also stored **AES-GCM-sealed** (key from `SESSION_SECRET`) | So credential slips can be re-printed; hashes alone can't be reversed. |
| Static-assets incremental cache (no R2/KV) | Nothing revalidates; free-plan friendly. |
| Answer-bearing test tables live in gitignored `content/answer-cases.json` | The GitHub repo is public and must never contain answers. CI runs the structural + synthetic tests. |
| Leak check exempts strings that are part of the public event branding | The final phrase is the first word of the event title. |
| Integration tests use **PGlite** (in-process Postgres) | No Docker; runs the real migration SQL incl. RLS and RPCs. |

## File tree (main parts)
```
app/                     pages (static shells) + api/ route handlers
  s/:token → scan/       QR landing (rewrite)      play/ finish/ rules/
  admin/ admin/teams/ judge/ board/ print/*  dev/kit/
  api/team/{login,logout,scan,state,submit,hint}
  api/admin/{snapshot,action,export}  api/judge  api/board  api/print  api/health  api/organiser/{config,me}
components/ui            Field Dossier kit (icons, PunchCard, Stamp, CodeBlock, Timer, Marquee…)
components/team          TeamApp + panels      components/organiser  admin/judge/board/print UIs
lib/game                 pure engine (match, scoring, progress, ids, format)
lib/server               server-only services (team, snapshot, reports, teams-admin, http, db)
lib/supabase             admin (secret key), server (SSR cookies), client (organiser login), middleware
supabase/migrations      schema + RPC functions (arrive, record_attempt, team_context, admin_snapshot, …)
scripts                  seed, db-push, smoke, load-test, check-design, check-secrets, check-leaks, cf-secrets
tests                    unit/ content/ integration/ (PGlite) e2e/ (Playwright)
content/hunt.json        REAL content — gitignored; hunt.example.json is the committed placeholder
```

## Data model
See `supabase/migrations/20261123000001_schema.sql`: `event_state` (singleton), `checkpoints`, `questions`,
`teams` (progress + optimistic `version`), `arrivals`, `attempts` (idempotency key), `score_entries`
(unique `team_id, ref` ledger), `scan_logs`, `hint_uses`, `audit_logs`, `login_throttle`.
