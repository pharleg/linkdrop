# LinkDrop — Phase 1 Design

**Date:** 2026-05-26  
**Scope:** Project scaffold, Supabase schema + RLS, auth, dashboard shell, slug redirect

---

## Overview

Phase 1 establishes the full foundation: Next.js 14 App Router scaffolded from scratch, Supabase schema for all four tables (future-proofed), multi-tenant auth via `@supabase/ssr`, a protected dashboard shell with all pages scaffolded, and a working slug redirect. No click tracking, no proposal rendering, no signatures — those ship in later phases. Everything built now must not require structural changes when later phases are added.

---

## Project Structure

```
linkdrop/
  app/
    (auth)/
      login/page.tsx
      signup/page.tsx
    (dashboard)/
      layout.tsx                  # protected layout, redirects if no session
      page.tsx                    # link list (empty state)
      links/
        new/page.tsx              # create link form — wired to DB
        [id]/page.tsx             # link detail + click timeline placeholder
      proposals/
        new/page.tsx              # proposal builder form — wired to DB
        [id]/page.tsx             # proposal detail + signature status placeholder
    [slug]/
      page.tsx                    # public: slug lookup + redirect (functional)
      sign/page.tsx               # public: placeholder
  components/
    SignatureCanvas.tsx            # placeholder stub
    ProposalViewer.tsx             # placeholder stub
    ClickTimeline.tsx              # placeholder stub
    LinkCard.tsx                   # placeholder stub
  lib/
    supabase/
      client.ts                   # browser Supabase client
      server.ts                   # server Supabase client (cookies)
      middleware.ts               # session refresh helper
    track.ts                      # stub — click logging (Phase 3)
    pdf.ts                        # stub — signature PDF gen (Phase 8)
  supabase/
    migrations/
      0001_schema.sql             # all 4 tables + indexes + RLS
  middleware.ts                   # session refresh + route protection
  .env.local                      # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Route groups `(auth)` and `(dashboard)` separate public and protected pages at the filesystem level. The `[slug]` routes are outside both groups — always public.

---

## Database Schema

Single migration: `supabase/migrations/0001_schema.sql`

Table creation order matters: `proposals` before `links` (FK dependency).

### Tables

**proposals**
```sql
id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id             uuid REFERENCES auth.users NOT NULL
title               text NOT NULL
body                text
logo_url            text
file_url            text
signature_required  boolean DEFAULT false
created_at          timestamptz DEFAULT now()
expires_at          timestamptz
```

**links**
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id          uuid REFERENCES auth.users NOT NULL
slug             text UNIQUE NOT NULL
destination_url  text
proposal_id      uuid REFERENCES proposals(id)
created_at       timestamptz DEFAULT now()
notify_on_first_click  boolean DEFAULT false
active           boolean DEFAULT true
CONSTRAINT destination_or_proposal CHECK (destination_url IS NOT NULL OR proposal_id IS NOT NULL)
```

**clicks**
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
link_id     uuid REFERENCES links(id) NOT NULL
clicked_at  timestamptz DEFAULT now()
ip_hash     text
user_agent  text
referrer    text
```

**signatures**
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
proposal_id     uuid REFERENCES proposals(id) NOT NULL
link_id         uuid REFERENCES links(id) NOT NULL
signer_name     text NOT NULL
signer_email    text NOT NULL
signature_data  text NOT NULL  -- base64 PNG
signed_at       timestamptz DEFAULT now()
ip_hash         text
CONSTRAINT one_signature_per_link UNIQUE (proposal_id, link_id)
```

### Indexes

```sql
CREATE INDEX ON links(user_id);
CREATE INDEX ON links(slug);
CREATE INDEX ON clicks(link_id);
CREATE INDEX ON proposals(user_id);
CREATE INDEX ON signatures(proposal_id);
```

### RLS Policies

**links**
- SELECT (owner): `user_id = auth.uid()`
- INSERT/UPDATE/DELETE: `user_id = auth.uid()`
- SELECT (public): `active = true` — allows slug lookup without auth

**clicks**
- SELECT (owner): `link_id IN (SELECT id FROM links WHERE user_id = auth.uid())`
- INSERT (public): permissive — anonymous visitors write click rows
- **Note:** fully permissive INSERT means a valid `link_id` can be spammed. Rate limiting is deferred to Phase 3 (click logging implementation) but must not be forgotten — bot traffic will corrupt analytics.

**proposals**
- SELECT (owner): `user_id = auth.uid()`
- INSERT/UPDATE/DELETE: `user_id = auth.uid()`
- SELECT (public): `id IN (SELECT proposal_id FROM links WHERE active = true)` — proposal visible only if its link is active

**signatures**
- SELECT (owner): `proposal_id IN (SELECT id FROM proposals WHERE user_id = auth.uid())`
- INSERT (public): `proposal_id IN (SELECT id FROM proposals WHERE expires_at IS NULL OR expires_at > now())`
- Duplicate signing prevented at schema level via `UNIQUE (proposal_id, link_id)` — not just UI

---

## Auth

**Package:** `@supabase/ssr`

**Three client instantiations:**
- `lib/supabase/client.ts` — browser client for Client Components
- `lib/supabase/server.ts` — server client reading cookies, for Server Components and Route Handlers
- `middleware.ts` — calls `supabase.auth.getUser()` on every request to refresh session token; redirects unauthenticated users hitting `/dashboard/*` to `/login`

**Auth pages:**
- `/login` — email/password via Server Action, `supabase.auth.signInWithPassword`, redirect to `/dashboard` on success
- `/signup` — email/password via Server Action, `supabase.auth.signUp`, redirect on success
- OAuth buttons present on both pages, disabled behind `NEXT_PUBLIC_OAUTH_ENABLED=false` — no code change needed to enable in a future phase

**Session:** cookies only, managed by `@supabase/ssr`. No JWT handling in app code.

---

## Dashboard Shell

**Layout:** sidebar nav (Links, Proposals, Settings) + top bar (user email, sign out). Server component — session read server-side.

| Route | Phase 1 Content |
|---|---|
| `/dashboard` | Empty state, "+ New Link" CTA |
| `/dashboard/links/new` | Form: slug, destination URL, notify toggle — INSERT to `links` |
| `/dashboard/links/[id]` | Link detail, click count (0), timeline placeholder |
| `/dashboard/proposals/new` | Form: title, body, logo upload — INSERT to `proposals` |
| `/dashboard/proposals/[id]` | Proposal detail, signature status placeholder |

**Styling:** raw Tailwind, no component library.

---

## Public Routes

| Route | Phase 1 Behaviour |
|---|---|
| `/[slug]` | Reads `links` by slug. If `destination_url` set: `redirect(destination_url)`. If `proposal_id` set: renders proposal (Phase 6). If not found or inactive: 404. |
| `/[slug]/sign` | Placeholder — "Signature coming soon" |

The slug redirect is the only functional end-to-end feature in Phase 1. It validates the schema, RLS public read, and routing all work together before any feature work begins.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_OAUTH_ENABLED=false
```

---

## Local Dev Setup

1. `npx create-next-app@latest linkdrop --typescript --tailwind --app --no-src-dir`
2. `npm install @supabase/ssr @supabase/supabase-js`
3. Copy `.env.local` values from Supabase project settings (API → Project URL + anon key)
4. Run `supabase/migrations/0001_schema.sql` against the remote project via Supabase SQL editor or MCP
5. Create a test user via Supabase Auth dashboard (Authentication → Users → Add user)
6. `npm run dev` — verify `/login` works and redirects to `/dashboard`

No local Supabase stack (Docker) required for Phase 1. All dev targets the remote `linkdrop.io` project directly.

---

## Out of Scope (Later Phases)

- Click rate limiting (Phase 3)
- Click logging (Phase 3)
- Proposal page rendering (Phase 6)
- SignatureCanvas implementation (Phase 7)
- PDF generation (Phase 8)
- Email notifications via Resend (Phase 9)
- Document markup (Phase 10)
- Stripe billing (Phase 12)
- Custom domain support (Phase 13)
