# PROGRESS

## Done
- [x] Phase 1 — scaffold, configs, env validation, Supabase clients, middleware, CI guard scripts
- [x] Phase 2 — migrations applied to the real Supabase project; RLS locked; RPC functions; seed; integrity + RLS tests
- [x] Phase 3 — game engine + unit tests (376 passing locally incl. real-question tables)
- [x] Phase 4 — team session/login/throttle, route handlers, PGlite SQL integration tests, API smoke run (62/62 against real Supabase)
- [x] Phase 5/6 — Field Dossier tokens, team screens, /dev/kit, visual QA at 360 + 414

- [x] Phase 7 — admin, teams, judge, board
- [x] Phase 8 — printables + client-side QR + print QA (every QR decoded in e2e)
- [x] Phase 9 — Playwright e2e (Pixel 7, iPhone 13, 360, 414: all pass), load test 40×2 (p95 469 ms, 0 5xx, 0 double-awards), Lighthouse mobile 95–97 perf / 100 a11y, leak + secret checks
- [x] Phase 10 — README + runbook, deployed to Cloudflare Workers

## Known gaps
- Team route JS is ~185 KB gzipped (React 19 + Next 16 runtime ≈ 175 KB; app code ≈ 9 KB) — over the 90 KB budget. Not reachable with Next.js.
- Lighthouse LCP ≈ 2.5 s on its simulated slow-4G profile (target 2 s).
