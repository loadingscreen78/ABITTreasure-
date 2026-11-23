# ABIT Tech Treasure Hunt — QR checkpoint web app

**CODE2CAREER · Department of Computer Science · Ajay Binay Institute of Technology (Autonomous), Cuttack**
*Decode • Discover • Win!*

A mobile-first QR checkpoint app for ~40 teams on campus phones. Teams scan 8 printed QR cards (CP-01 … CP-08), answer each
checkpoint's question, and a correct answer decrypts the riddle that leads to the next location. Organisers run the event from
`/admin`, the finish-desk judge uses `/judge`, and `/board` goes on the projector.

- **Live:** https://abit-hunt.jagannathmishra540.workers.dev (Cloudflare Workers, free plan)
- **Database + organiser auth:** Supabase (project region Tokyo, `ap-northeast-1`)
- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · `@supabase/ssr` · jose · bcryptjs · zod · qrcode · SWR · Vitest · Playwright

> The real clues/answers live in `content/hunt.json`, which is **gitignored** (the repo is public). The committed
> `content/hunt.example.json` has the same structure with placeholders. Keep `content/hunt.json` safe — it is the source of truth.

---

## 1. Run locally

Requires Node **≥ 20.9** (22.12+ recommended; 22.8 works).

```bash
npm install
# .env.local (never committed) — see .env.example for every name
npm run db:push        # apply supabase/migrations to your Supabase project
npm run seed           # load content/hunt.json, create checkpoint tokens + rehearsal team T00
npm run dev            # http://localhost:3000
```

Open a checkpoint as a team: `npm run seed` prints the 8 QR URLs (`/s/<token>`). T00's password is in the gitignored
`credentials-*.txt` it writes (or reset it from `/admin → Rehearsal`).

### Environment variables (`.env.local`, and Cloudflare secrets in production)
| Name | What | Where it is used |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | server + organiser login |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` — browser-safe **only because RLS is on** | organiser login |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` — **server only** (`lib/supabase/admin.ts`, `import "server-only"`) | all game reads/writes |
| `SUPABASE_JWKS_URL` | optional; `getClaims()` discovers it | — |
| `SESSION_SECRET` | 32+ random bytes; signs team cookies, seals slip passwords | server |
| `PUBLIC_BASE_URL` | short deployed URL used inside the QR codes | QR cards |
| `SECRET_WORD` | initial volunteer word (only read by `npm run seed` on first seed) | seed |
| `BCRYPT_COST` | default 5 (free-plan CPU); 10 on Workers Paid | server |
| `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_POOLER_HOST` | local scripts only (`db:push`) | never deployed |

Missing values never crash the app: teams see "Event system is warming up, please ask a volunteer", organisers see
"Setup incomplete — missing X", and `/api/health` lists the missing names.

---

## 2. Database (Supabase)

Tables, RLS lockdown and the atomic game functions are in `supabase/migrations/`. **Every table has RLS on with no policies**, and
`anon` / `authenticated` have no grants, so the publishable key can read nothing. Only the server's secret key can touch data.

Apply the migrations in **one of three ways**:
1. `npm run db:push`: uses the Supabase CLI with the pooler URL built from `.env.local`.
   (Find the pooler host with `node --env-file=.env.local scripts/find-pooler.mjs`.)
2. `npx supabase login && npx supabase link --project-ref <ref> && npx supabase db push`
3. `npm run db:sql`, then paste `supabase/combined.sql` into **Supabase → SQL Editor → Run**.

Then seed the content:
```bash
npm run seed                          # content + tokens (existing tokens are KEPT, so printed QRs stay valid)
npm run seed -- --teams teams.csv     # also create teams from CSV: name,member1,member2,member3,member4 (prints passwords once)
npm run seed -- --rotate-tokens       # new QR tokens (breaks printed cards!)
npm run seed -- --reset-settings      # overwrite admin-changed settings with hunt.json
```

### Organiser accounts (admin / judge)
Organisers are Supabase Auth users with `app_metadata.role` = `admin` or `judge`.
- **Script:** `npm run organisers -- admin=you@college.edu judge=judge@college.edu` creates or updates the users with random
  passwords and writes them to a gitignored `organisers-<date>.txt`.
- **Dashboard:** Authentication → Users → Add user, then in SQL Editor:
  ```sql
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = 'you@college.edu';
  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"judge"}' where email = 'judge@college.edu';
  ```
Every admin/judge API call verifies the JWT with `supabase.auth.getClaims()` and checks the role.

---

## 3. Deploy to Cloudflare Workers

```bash
npx wrangler login                                   # once
npm run cf:deploy                                    # secret-free build (OpenNext) + deploy
npm run cf:secrets -- https://<your-worker>.workers.dev   # push runtime config as encrypted Worker secrets
```
- `cf:deploy` runs `scripts/cf-build.mjs`. It hides `.env.local` during the build, so no secret is baked into the Worker, and it
  fails if one is found. Secrets live only in Cloudflare's encrypted store (`cf:secrets`, values never printed).
- `wrangler.jsonc` pins **targeted placement** to `aws:ap-northeast-1` (next to Supabase). Database round-trips drop from
  ~110 ms to ~15 ms. If you move the database, change the region.
- **Free plan notes:** every page is prerendered static, and each team action is one JSON call with 1–2 DB round-trips. bcrypt
  cost is 5. Worker size is 1.6 MiB gzipped (limit 3 MiB). Daily limit is 100k requests; a 40-team hunt uses about 3k.
- Keep `PUBLIC_BASE_URL` short; it is printed inside every QR. A custom domain (Workers → Settings → Domains) shortens it.
  Change it **before** printing, then run `npm run cf:secrets -- <new url>`.
- Check `https://<worker>/api/health` → `{"ok":true …}` before the event.

The CI workflow (`.github/workflows/ci.yml`) runs typecheck, lint, tests, design check, build, secret-leak and content-leak checks
on every push. Deploys run from an organiser machine (`npm run cf:deploy`) because the real `hunt.json` is not in git.

---

## 4. Tests

| Command | What |
|---|---|
| `npm test` | Vitest: matching for every mode (synthetic tables, committed), per-question accept/reject tables (local only, from the gitignored `content/answer-cases.json`), scoring, time bonus, state machine, content integrity, **Postgres integration on PGlite with the real migrations** (concurrency/version conflicts, idempotency, cooldown, throttle, RLS lockdown), QR decode |
| `npm run smoke [-- <url>]` | API-level T00 run CP-01 → CP-08 against a live app: exact riddles, near-miss, 4 wrong → cooldown, idempotent retry, 2 phones, wrong-turn / already-cleared, ledger totals. Resets T00 |
| `npm run test:e2e` | Playwright on Pixel 7 + iPhone 13 (+ 360×780 / 414×896 screenshots in `qa/screens`): full UI run, phone B mid-run, tap targets, organiser login, print QA (every QR decoded), judge permissions, board |
| `node --env-file=.env.local scripts/load-test.mjs <url> 40` | 40 teams × 2 phones run the whole hunt at once, then verify the ledger. Uses temporary rehearsal teams and deletes them |
| `npm run check:design` / `check:secrets` / `check:leaks` | banned-design guard / secret key not in client bundles / no clue or answer in client bundles |

---

## 5. Event-day runbook

**T-2 days**
- [ ] Fill every `TODO(ORGANISER)` (below): venue spots (`/admin → Checkpoints & venues`), logo, real organiser emails.
- [ ] Change the secret word (`/admin → Settings`). The event pack's sample word is public.
- [ ] Import teams (`/admin/teams → Bulk CSV import`, or `npm run seed -- --teams teams.csv`).
- [ ] Print from `/print`: checkpoint QR cards, the volunteer secret-word QR, credential slips, and one answer key for the judge.
- [ ] Scan **every printed QR with 3 phones** (Android + iPhone). Each must open the right `/s/…` page.

**T-1 day**
- [ ] Walk the full route on mobile data as **T00** (`/admin → Rehearsal → New T00 password`), scanning the real printed cards.
- [ ] `/admin → Reset T00`. Confirm venue spots and volunteer positions (CP-06 volunteer holds the secret-word QR; the judge holds CP-08).

**Event day**
- [ ] Open `/admin`; check `/api/health` and Station health. Put `/board` on the projector (`/board?theme=dark` for dark halls).
- [ ] Hand out slips. Press **Start (3-2-1)**. The judge opens `/judge` at the finish desk.
- [ ] Watch flags: OUT-OF-ORDER scans, ≥ 4 wrong, inactive > 5 min, crowding ≥ 5 at a station.

**Fallback if the internet fails:** volunteers switch to the paper answer sheets and printed clue cards from the event pack. The
judge keeps one printed answer key.

**After**
- [ ] Press **End**. The judge confirms finals and enters teamwork (0–5) for each finished team.
- [ ] Check the time bonus (Settings: tiered 5/3/1 or tie-breaker only). Tie-breaker questions are in `/judge`.
- [ ] Press **Reveal results**. Export the judge-sheet CSV, the attempts-log CSV, and all team answer sheets (`/print/team`).
- [ ] Rotate the Supabase secret key, then delete the `credentials-*.txt` / `organisers-*.txt` files.

---

## 6. TODO(ORGANISER)
1. **Official ABIT logo**: add `public/brand/abit-logo.png` and set `BRAND.logo` in `lib/brand.ts`. Until then a text wordmark is used.
2. **Exact venue spots** for CP-01…CP-07 (`venueDetail` in `content/hunt.json`, or edit live in `/admin`). The CP-06 venue name is also needed.
3. **Real organiser emails**: placeholder accounts `admin@abit-hunt.test` / `judge@abit-hunt.test` exist (passwords in `organisers-2026-11-23.txt`). Re-run `npm run organisers -- admin=… judge=…` with real addresses.
4. **Secret word**: change it from the sample.
5. **Time limit**: off by default (`timeLimitMinutes = 0`). Set it in `/admin → Settings` if "TIME'S UP" should trigger automatically.
6. **Domain**: optional short custom domain for the QR URL.

## 7. Design
"Field Dossier": graph-paper case files, punch cards, rubber stamps, mono metadata. Tokens are in `app/globals.css`, the kit is in
`components/ui`, and the dev-only sheet is at `/dev/kit` (with `npm run dev`). `scripts/check-design.mjs` blocks banned hues,
gradients, blur, soft corners, banned fonts and emoji.
