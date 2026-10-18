---
name: atlas-setup
description: Agent-led setup of this Atlas folder for people with no technical background — check the computer, install Atlas into the user's own new Supabase project, configure and start the app, then publish to the user's own GitHub repository and deploy on Hostinger. Claude does the work and stops only for steps that need the user's account, decision or approval. Use when the user asks to set up, install, connect, publish or deploy Atlas, or to continue a setup that was interrupted.
---

# Atlas setup

You are setting up Atlas **for** someone with no technical background. You do the work; the user
only does what needs their account, their decision or their approval.

## How to behave

- **Keep going.** When a step succeeds, start the next one. Never ask "Continue?", "Shall I
  check…?", "Do you want to test…?" or "Would you like to customize…?".
- **Report, don't quiz.** One or two plain-language lines per section: what was done and what was
  verified. No command output or jargon unless something went wrong.
- **Stop only at the user moments below.** Each is one message that says exactly where to click or
  what to type. When the user answers, resume without re-confirming.
- **One approval covers everything it named.** After the user approves an install or a publish,
  carry out every step it listed, in order. Ask again only for something it did not name, or when
  a check turns up something unexpected.
- **No homework.** Never ask the user to add vehicles, customers, rentals or payments, refresh
  pages, look at Calendar or Reports, or otherwise test the app. Verify with the checks below.
  Anything a check cannot prove is **not verified** — say so; never claim it passed.
- **Keep Atlas's defaults.** Don't ask about name, tagline, colours or logo. Customize only when
  the user asks (end of this file).
- **Never display secrets**: access tokens, database password, secret / service_role keys,
  invitation links. The publishable key is public; show it only when the user must paste it into
  Hostinger.
- **Stop on the first unexpected result.** Explain it plainly, propose one fix, wait. Never retry
  a migration blindly or finish one by hand in the SQL editor.
- **One project.** Before every command that reaches Supabase, `supabase/.temp/project-ref` must
  equal the ref the user confirmed.
- Run commands from the Atlas folder with `npx supabase …` (the CLI is a dev dependency). When you
  run them, `projects list` and `migration list` print JSON; do not add `-o json` to
  `migration list` — that prints a table there.

## The user moments — the only times you stop

1. **Project:** create a Supabase project and paste its ID (plus `npx supabase login`, only if the
   CLI is not signed in).
2. **Install approval:** one yes to install Atlas into that project.
3. **Sign-up:** set the local Auth URLs, then create the first Owner account and confirm its email.
4. **GitHub:** an empty private repository, one yes to publish to it (plus a Git sign-in or
   name/email only if Git asks).
5. **Hostinger:** the hPanel steps, then the live Auth URLs.

## Resuming

Start every session with `npm run setup:check`. If the folder is linked, also run the read-only
checks in B4 (verification) and C3. Work out the furthest completed step, say where things stand
in one line, and carry on.

---

## A. The computer — no user action unless something is missing

1. `node --version`, `git --version`; `npm ci` if `node_modules` is missing; `npm run setup:check`.
2. Only if Node is missing or older than 20.19, or Git is missing: say what to install (Node.js LTS
   from nodejs.org, Git from git-scm.com) and wait. An old Git only matters in section D.
3. One status line, then straight to B.

## B. Supabase

1. `npx supabase projects list -o json` (read-only) tells you whether the CLI is signed in.
2. **User moment 1 — one message:** create a **new** project at supabase.com/dashboard (a Free
   organization is fine; keep the database password somewhere safe) and paste its **Project ID**
   (Project Settings → General, or the part before `.supabase.co`). If the CLI is not signed in,
   add: run `npx supabase login` in the terminal panel and finish the sign-in in the browser.
   Never pick a project yourself, even though you can see every project in their account.
3. Find the ref in the list. Not there → they are signed in to another account: say so and stop.
   Otherwise **user moment 2 — one message:** show the project's name, region and creation date
   and ask: "Install Atlas into this project? I'll connect this folder to it, make sure it is
   empty, create the Atlas database (54 steps) and install its 4 background services. If it is not
   empty I'll stop and change nothing." A yes approves everything in that sentence.
4. Then, without asking again:
   - `npx supabase link --project-ref <ref>` (if it asks for the database password, ask the user
     to run the same command in the terminal panel); confirm `supabase/.temp/project-ref`.
   - Read-only state check:
     `npx supabase db query --linked "select (select count(*) from information_schema.tables where table_schema = 'public') as public_tables, (select count(*) from auth.users) as users, (select count(*) from storage.objects) as files"`
     and `npx supabase migration list --linked`.
     - 0 tables, 0 users, 0 files, no history → **empty**: continue.
     - 0 users, 0 files, a history made only of Atlas's own migration files → **an earlier install
       stopped**: say so and continue (the push applies only what is missing).
     - Anything else → **in use**: stop, change nothing, run `npx supabase unlink`, and explain that
       Atlas goes into a new, empty project. A live Atlas with users is never touched by setup.
   - `npx supabase db push --dry-run` → the missing Atlas migrations (all 54 on an empty project).
     Anything else is unexpected: stop.
   - `npx supabase db push --yes` (a few minutes; a Docker warning is harmless).
   - Verify: `npx supabase migration list --linked` shows every local migration remotely; and with
     `npx supabase db query --linked "<sql>"`:
     - `select count(*) filter (where not c.relrowsecurity) as rls_off from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p')` → 0
     - `select id, public from storage.buckets order by id` → 7 buckets, none public
     - `select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal` → includes `on_auth_user_created`
   - `npx supabase functions deploy --project-ref <ref>`, then
     `npx supabase functions list --project-ref <ref> -o json` → `team-invitations`,
     `gps-provider`, `billing`, `billing-webhook` all ACTIVE.
   - A push that stops part-way: report the failing migration and wait. After the fix (or after a
     dropped connection) `--dry-run` shows only what is left; applying that is covered by the same
     approval.
5. One status line, then straight to C.

Resuming in a folder already linked to the project chosen earlier: skip the state check — users
and files there are the owner's own.

## C. Configure, start, sign up

1. `npm run setup:env -- <ref>` writes `.env.local` (publishable key only; it prints just the kind
   of key). Never run `supabase projects api-keys` yourself — its output holds secret keys. If
   `.env.local` already exists, ask before adding `--force`. `npm run setup:check` must then pass.
2. Start `npm run dev` in the background; wait until `http://localhost:5173` answers.
   **User moment 3 — one message** with everything at once:
   - Supabase → Authentication → URL Configuration: **Site URL** `http://localhost:5173`;
     **Redirect URLs** `http://localhost:5173/auth/callback`, `http://localhost:5173/accept-invite`,
     `http://localhost:5173/auth/reset-password`, `http://localhost:5173/confirm-email`.
   - Open `http://localhost:5173` → **Create an agency**. Use the **same email as their Supabase
     account** — Supabase's built-in email reaches only project members, about two messages an
     hour. Open the confirmation email **in the same browser**, then sign in.
   - Reply when the dashboard shows the agency.
3. Verify without asking:
   `npx supabase db query --linked "select o.name, m.role from public.organizations o join public.organization_members m on m.organization_id = o.id"`
   → their agency with role `owner`. If it is missing, diagnose (other email, unconfirmed address,
   Auth URLs) before suspecting Atlas.
4. Automatic checks, no questions, nothing remote:
   - `npm run build` succeeds.
   - `npx vitest run supabase/tests` — replays every migration on a throw-away local Postgres and
     runs Atlas's database tests: tenant isolation, roles, vehicles, rentals and overlaps,
     payments, expenses, financing, reports.
5. **Local setup is complete.** Summarize in a few lines:
   - Verified on their project: database, row-level security, private storage, background
     services, configuration, app running, their Owner agency.
   - Verified by the automated suite (locally): the business workflows.
   - Not verified on their project: day-to-day use (vehicles, customers, rentals) — they can try
     it whenever they like; it is not part of setup.

   Then go straight to D.

## D. Their own GitHub repository

1. Prepare locally, no approval needed: `git --version`, `npm run setup:check`, and work out:
   - Cloned from the original (`origin` is `github.com/salhiworks/atlas-car-rental-saas`) →
     `origin` will become `upstream` with pushing disabled.
   - Downloaded as a ZIP (no `.git`) → a repository will be created (`git init` then
     `git checkout -b main`; `git init -b` needs Git 2.28+).
   - Nothing private can be committed: `git check-ignore -q .env.local` succeeds (a ZIP folder
     runs this right after `git init` in step 3, before anything is added).
2. **User moment 4 — one message:** create an **empty, private** repository at github.com/new (no
   README, licence or .gitignore) and paste its URL. If it is the original Atlas repository or not
   a GitHub URL, say so and ask again — never publish there. Otherwise show in one short block: the
   repository, branch `main`, that `.env.local` stays on this computer, that nothing can be pushed
   to the original Atlas repository — and ask "Publish Atlas to this repository?" A yes approves
   all of step 3.
3. Then, without asking again:
   - Clone: `git remote rename origin upstream`;
     `git remote set-url --push upstream DISABLED--never-push-to-original-atlas`.
     ZIP: `git init`; `git checkout -b main`; `git check-ignore -q .env.local` must succeed.
   - `git remote add origin <url>`; `git add -A`; confirm `git status --short` lists no `.env*`
     (except `.env.example`), `dist/`, `node_modules/` or `supabase/.temp/`;
     `git commit -m "Set up Atlas"`. If Git asks who they are, ask once for the name and email for
     their commits and set them for this folder only (`git config user.name/user.email`).
   - `git push -u origin main`.
     - `RPC failed; HTTP 400` (old Git): retry once with
       `git -c http.postBuffer=157286400 push -u origin main`.
     - Git needs a sign-in: ask the user to run the same push in the terminal panel and sign in
       when asked (GitHub refuses account passwords — use the browser sign-in or a personal access
       token).
     - Rejected because the repository is not empty: stop. Never force-push.
   - Verify `git ls-remote origin main` equals `git rev-parse HEAD`.
4. One status line, then straight to E.

## E. Hostinger

1. **User moment 5 — one message** with the exact values: **Hostinger → Websites → Add Website →
   Web App → Import Git Repository**; connect GitHub (**Only select repositories** → theirs);
   branch **main**; the free temporary domain or their own; **Node.js 22**; build command
   **`npm run build`**; output directory **`dist`**; exactly two environment variables,
   `VITE_SUPABASE_URL` = `https://<ref>.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY` = the
   publishable key from `.env.local` (show it; it is public), ignoring any other suggestions;
   **Deploy**; then paste the site address.
2. When they paste it, verify without asking: `curl -sI https://<domain>/` → 200 with
   `strict-transport-security`; `curl -s -o /dev/null -w "%{http_code}" https://<domain>/settings`
   → 200; the site's JavaScript mentions `<ref>.supabase.co` and no other project.
3. Final message: in Supabase → Authentication → URL Configuration set **Site URL** to
   `https://<domain>` and add `https://<domain>/auth/callback`, `/accept-invite`,
   `/auth/reset-password`, `/confirm-email` (keep the localhost ones); then they can sign in on the
   live site. Close with what is live, that every push to `main` redeploys, and the one thing to do
   before real customers (below).

## Before real customers, and optional extras

- **Their own email provider (SMTP)** — Supabase → Authentication → Emails → SMTP Settings. Needed
  before anyone outside their Supabase team can sign up.
- Optional, any time: team invitation emails (Resend), Stripe subscriptions, GPS (Wialon, entered
  in the app), map tiles — README.md → "Optional configuration" and "Edge Function secrets".
  Secrets go into Supabase (Edge Functions → Secrets), never `.env.local` or Hostinger.

## Customization — only on request

Product name and tagline: `src/lib/config/brand.ts` (`name`, `fullName`, `tagline`; keep
`creator`, `creatorUrl` and the MIT notice). Colours: the `--color-brand-*` variables in
`src/styles/index.css`. Icon: `public/favicon.svg`. Agency details, logo, currency and contract
wording are in the app under **Settings**. Never touch migrations, RLS, authorization or payment
logic while customizing; `npm run build` must pass afterwards.

## Later updates

Every push to `main` redeploys on Hostinger. An Atlas update that adds a migration:
`npx supabase db push --dry-run`, then apply it with the owner's approval.
