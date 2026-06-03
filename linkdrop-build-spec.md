# LinkDrop — Autonomous Build Spec

## Purpose of This Document

This spec is written for an AI coding agent (Claude Code or equivalent) to build LinkDrop from scratch with zero human input required. Every decision that would normally require clarification has been made in advance and documented here. The agent should read this document fully before writing a single line of code, then execute the build order sequentially without stopping for approval.

---

## What We're Building

LinkDrop is a link shortener with click tracking, proposal pages, e-signatures, and document markup. It is a SaaS product with Stripe billing. Target market is solo service operators and small agencies (trades, contractors, consultants) who need a lightweight alternative to DocuSign + Docsend combined.

---

## Decisions Made in Advance

The agent must not ask about any of the following. These are final.

**Domain / branding:** Use `linkdrop.io` throughout the codebase as the assumed domain. All short link examples use this domain. If the domain is unavailable at launch, a find/replace handles it. Do not pause to check domain availability.

**Auth provider:** Supabase Auth with email/password and magic link. No OAuth providers in MVP. Email confirmation required before first login.

**Email provider:** Resend. Use the package `resend`. API key comes from `RESEND_API_KEY` env var. Sender address is `noreply@linkdrop.io`. Do not ask about email setup; stub the integration and note where the key goes.

**PDF generation:** Use `@react-pdf/renderer` for the signed document output. Append signer name, email, and timestamp to the bottom of the proposal content. No fancy certificate block needed for MVP — plain text footer with a horizontal rule.

**Signature canvas:** Use `react-signature-canvas`. Typed name is also accepted as a fallback (checkbox: "I prefer to type my name"). Both are stored as base64 PNG in Supabase Storage bucket `signatures`.

**Slug generation:** Random 6-character alphanumeric by default (e.g. `abc123`). User can override with a custom slug at creation time. Collision check on save — if taken, auto-append one digit and retry once. If still taken, surface an inline error.

**Short link redirect:** Implemented as a Next.js middleware rewrite at `middleware.ts`. Pattern: any path that does not start with `/dashboard`, `/api`, `/_next`, or `/auth` is treated as a potential slug lookup. Fetch the link from Supabase in middleware using the service role key. If found and active, rewrite to `/r/[slug]` which is the actual redirect/proposal render route. If not found, return 404.

**Click logging:** Edge function at `/api/track`. Called from the redirect route before rendering or redirecting. Logs: `link_id`, `clicked_at` (server time), `ip_hash` (SHA-256 of `x-forwarded-for`, never raw), `user_agent`, `referrer`. Fire-and-forget — do not await in the critical path if it adds latency. Use `waitUntil` if available in the runtime.

**First-click notification:** Send via Resend when `notify_on_first_click = true` and `clicks` count for that link was 0 before this event. Subject: `Someone opened your link — [slug]`. Body: plain text with timestamp and a link to the dashboard.

**Document markup:** Paragraph-level only for MVP. Recipient can click any paragraph to either strike it through or attach an inline comment. Strikethrough stored as a boolean per paragraph ID. Comments stored in a `markups` table. Sender gets an email notification on each new markup. Sender can reply to a comment inline. No threading beyond one level of reply for MVP.

**Revised versions:** When sender pushes a revision, the `proposal_id` stays the same but a `revision` integer increments. All prior revisions are stored and readable. The active revision is always the highest number. Recipient always sees the latest revision.

**Stripe billing:** Use `stripe` npm package. Webhook endpoint at `/api/webhooks/stripe`. On `checkout.session.completed`, set the user's `plan` field in the `profiles` table to `starter` or `pro`. On `customer.subscription.deleted`, revert to `free`. Price IDs come from env vars `STRIPE_STARTER_PRICE_ID` and `STRIPE_PRO_PRICE_ID`. Do not hardcode prices.

**Free tier limits:** Enforced server-side in the API routes, not just client-side. Before creating a link or proposal, check the user's current count against their plan limit. Return a 403 with `{ error: "plan_limit_reached" }` if exceeded. The client reads this and shows an upgrade prompt.

**Plan limits:**
- Free: 5 active links, 0 proposals, 0 signatures
- Starter: 25 active links, 5 proposals, signatures enabled, markup enabled
- Pro: unlimited links and proposals, custom domain (stubbed for now), 2 team seats (stubbed for now)

**Custom domain (Pro):** Stub the UI and database column. The settings page has a "Custom Domain" section that says "Coming soon — enter your domain and we'll reach out with setup instructions." Store the input in `profiles.custom_domain`. Do not implement actual domain routing in MVP.

**Team seats (Pro):** Stub only. Settings page has a "Team" section that says "Coming soon." No invite flows or multi-user logic in MVP.

**White-label proposals (Pro):** On Pro, the `linkdrop.io` wordmark is hidden from the proposal footer. On Free and Starter, a small "Powered by LinkDrop" footer link appears. Controlled by a `hide_branding` boolean on the `profiles` table, set to true for Pro users on webhook.

**Error handling:** All API routes return `{ error: string }` on failure with the appropriate HTTP status. Client components display inline errors, never silent failures. No toast libraries — use inline error states.

**Loading states:** Use React Suspense with skeleton loaders for dashboard data. Do not use spinners. Skeleton should match the shape of the content it replaces.

**Testing:** Write tests for: slug collision logic, click logging (mock Supabase), plan limit enforcement, signature PDF generation (snapshot). Use Vitest. Test files live in `__tests__/`. Do not skip tests or leave them empty.

**Styling:** Tailwind CSS only. No component libraries. No shadcn. Custom color palette defined in `tailwind.config.ts`. Design direction is editorial/utilitarian — dark sidebar, light content area, monospace accents for timestamps and IDs. Font: `IBM Plex Mono` for code/timestamps, `IBM Plex Sans` for body. Both loaded via `next/font/google`.

**Environment variables required:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_STARTER_PRICE_ID
STRIPE_PRO_PRICE_ID
NEXT_PUBLIC_APP_URL   # e.g. https://linkdrop.io
```

All are required. The app should throw a startup error (not a runtime 500) if any are missing. Check in a `lib/env.ts` module that is imported at the top of `instrumentation.ts`.

---

## Database Schema

Run these migrations in order. Do not alter the upsert keys or column names — they are referenced throughout the codebase.

```sql
-- profiles: extends auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  plan text not null default 'free', -- free | starter | pro
  stripe_customer_id text,
  stripe_subscription_id text,
  custom_domain text,
  hide_branding boolean not null default false,
  created_at timestamptz not null default now()
);

-- trigger: auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- proposals
create table proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  logo_url text,
  signature_required boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- proposal_revisions: versioned content
create table proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  revision integer not null default 1,
  body text not null, -- markdown
  file_url text,
  created_at timestamptz not null default now(),
  unique(proposal_id, revision)
);

-- links
create table links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  destination_url text,
  proposal_id uuid references proposals(id) on delete set null,
  notify_on_first_click boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint destination_or_proposal check (
    destination_url is not null or proposal_id is not null
  )
);

-- clicks
create table clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  referrer text
);

-- signatures
create table signatures (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  link_id uuid not null references links(id) on delete cascade,
  revision integer not null,
  signer_name text not null,
  signer_email text not null,
  signature_data text not null, -- base64 PNG
  signed_at timestamptz not null default now(),
  ip_hash text
);

-- markups: paragraph-level comments and strikethroughs
create table markups (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  revision integer not null,
  paragraph_index integer not null,
  markup_type text not null check (markup_type in ('strikethrough', 'comment')),
  comment_text text,
  reply_text text,
  author_role text not null check (author_role in ('sender', 'recipient')),
  created_at timestamptz not null default now()
);
```

Storage buckets required (create via Supabase dashboard or migration):
- `signatures` — private, accessed via signed URL
- `proposal-files` — private, accessed via signed URL
- `logos` — public

---

## App Structure

```
app/
  (auth)/
    login/page.tsx
    signup/page.tsx
    confirm/page.tsx           magic link / email confirm landing
  (dashboard)/
    layout.tsx                 sidebar nav, auth guard
    page.tsx                   redirect to /dashboard/links
    dashboard/
      links/page.tsx           link list with click counts
      links/new/page.tsx       create link form
      links/[id]/page.tsx      link detail: click timeline, stats
      proposals/page.tsx       proposal list
      proposals/new/page.tsx   proposal builder
      proposals/[id]/page.tsx  proposal detail: revision history, signature status, markups
      billing/page.tsx         plan status, upgrade CTA, Stripe portal link
      settings/page.tsx        profile, custom domain stub, team stub
  [slug]/page.tsx              public: redirect or render proposal
  [slug]/sign/page.tsx         public: signature capture
  api/
    track/route.ts             click logging
    sign/route.ts              signature save + PDF generation
    webhooks/stripe/route.ts   Stripe webhook handler
    links/route.ts             CRUD
    proposals/route.ts         CRUD
    markups/route.ts           create markup, post reply
middleware.ts                  slug resolution
lib/
  supabase.ts                  server + client helpers
  env.ts                       env validation
  pdf.ts                       signed PDF generation
  track.ts                     click log helper
  slug.ts                      slug generation + collision check
  limits.ts                    plan limit checks
components/
  SignatureCanvas.tsx
  ProposalViewer.tsx            renders markdown + paragraph markup layer
  ClickTimeline.tsx
  LinkCard.tsx
  PlanGate.tsx                 wraps features behind plan check
  Skeleton.tsx
__tests__/
  slug.test.ts
  limits.test.ts
  track.test.ts
  pdf.test.ts
```

---

## Build Order

Execute in sequence. Do not start the next step until the current one passes its associated tests or can be manually verified.

1. Repo init: `create-next-app` with TypeScript, Tailwind, App Router. Install all dependencies upfront: `supabase`, `@supabase/ssr`, `resend`, `stripe`, `react-signature-canvas`, `@react-pdf/renderer`, `vitest`, `@vitejs/plugin-react`. Configure `tailwind.config.ts` with the IBM Plex font tokens and color palette.

2. `lib/env.ts` — validate all required env vars at startup. Write `instrumentation.ts` to import it.

3. Supabase schema — apply all migrations above. Generate TypeScript types via `supabase gen types`. Output to `types/supabase.ts`.

4. Auth flows — login, signup, magic link confirm pages. Supabase Auth SSR cookie handling. Auth guard in the dashboard layout.

5. `lib/slug.ts` — slug generation and collision check. Write `__tests__/slug.test.ts` and pass.

6. `lib/limits.ts` — plan limit checks against `profiles` and live counts. Write `__tests__/limits.test.ts` and pass.

7. Links API (`/api/links`) — create, list, toggle active. Enforce plan limits. Validate slug on create.

8. Middleware — slug resolution rewrite logic.

9. Click tracking — `/api/track` route and `lib/track.ts`. Write `__tests__/track.test.ts` (mock Supabase insert).

10. Redirect route — `/[slug]/page.tsx` calls track, then either redirects or renders the proposal.

11. Dashboard: links list and link detail with click timeline.

12. Proposals API (`/api/proposals`) — create, list, add revision. Enforce plan limits.

13. Proposal builder UI — title, logo upload to `logos` bucket, markdown body editor (plain `<textarea>`, no rich text library), file upload to `proposal-files` bucket.

14. Proposal viewer — `ProposalViewer.tsx` renders markdown with a paragraph markup layer. Each paragraph is individually addressable by index.

15. Markup API (`/api/markups`) — create strikethrough or comment, post reply. Send email notification to sender on new recipient markup.

16. Signature capture — `/[slug]/sign/page.tsx` with `SignatureCanvas.tsx`. Typed name fallback. Submit calls `/api/sign`.

17. `/api/sign` — validate, save signature to Storage, record in `signatures` table, generate signed PDF via `lib/pdf.ts`, store PDF, send confirmation email to both parties. Write `__tests__/pdf.test.ts`.

18. Proposal detail page — revision history, markup thread, signature status, download signed PDF button.

19. Stripe billing — webhook handler, plan gate component, billing settings page, upgrade flow via Stripe Checkout. Write `__tests__/limits.test.ts` additions for Stripe plan transitions.

20. Polish: skeleton loaders, inline error states, "Powered by LinkDrop" footer, hide branding for Pro, responsive layout audit.

21. Final: `README.md` with local setup instructions and env var reference.

---

## What the Agent Should Never Do

- Stop and ask which approach to use for something already decided in this document.
- Ask for approval before running a migration or installing a package.
- Ask what the color palette should be or what fonts to use (IBM Plex Sans + IBM Plex Mono, see above).
- Leave a `// TODO` without also writing the stub that makes the app compile.
- Skip tests or write empty test stubs.
- Use any component library other than Tailwind.
- Implement OAuth, team invites, or custom domain routing — these are explicitly deferred.
- Hardcode Stripe price IDs, API keys, or URLs.
- Store raw IP addresses anywhere.

If an ambiguous situation arises that is genuinely not covered by this document, make the most conservative, reversible decision and add a comment: `// DECISION: [what was decided and why]`. Do not stop the build.
