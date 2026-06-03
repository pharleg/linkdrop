# LinkDrop Full Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete LinkDrop SaaS product per `linkdrop-build-spec.md` — link shortener with click tracking, proposal pages, e-signatures, document markup, and Stripe billing.

**Architecture:** Next.js 16 App Router with Supabase (auth + database + storage), all routes under `app/(dashboard)/dashboard/` prefix, public slug routes at `app/[slug]/`, API routes at `app/api/`. Server components fetch data; client components handle interactivity. Plan limits enforced server-side in API routes.

**Tech Stack:** Next.js 16, Supabase + @supabase/ssr, Tailwind v4, Stripe, Resend, react-signature-canvas, @react-pdf/renderer, Vitest

---

### Task 1: Install dependencies + configure fonts

**Files:**
- Modify: `package.json`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install all missing deps**

```bash
npm install stripe resend react-signature-canvas @react-pdf/renderer
npm install --save-dev vitest @vitejs/plugin-react @vitest/ui
npm install --save-dev @types/react-signature-canvas
```

- [ ] **Step 2: Verify installs**

```bash
node -e "require('stripe'); require('resend'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 4: Add IBM Plex fonts to app/layout.tsx**

```typescript
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Update globals.css with Tailwind v4 theme tokens**

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono), ui-monospace, monospace;

  --color-sidebar: #111111;
  --color-sidebar-text: #a3a3a3;
  --color-sidebar-active: #ffffff;
  --color-content: #ffffff;
  --color-border: #e5e5e5;
  --color-muted: #737373;
  --color-accent: #2563eb;
  --color-danger: #dc2626;
}
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts app/layout.tsx app/globals.css
git commit -m "feat: install deps, configure IBM Plex fonts, vitest"
```

---

### Task 2: Database migration — profiles, proposal_revisions, markups

**Files:**
- Create: `supabase/migrations/0002_profiles_revisions_markups.sql`

- [ ] **Step 1: Write migration file**

```sql
-- profiles: extends auth.users
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  custom_domain text,
  hide_branding boolean not null default false,
  created_at timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- proposal_revisions: versioned content
create table if not exists proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  revision integer not null default 1,
  body text not null,
  file_url text,
  created_at timestamptz not null default now(),
  unique(proposal_id, revision)
);

-- markups: paragraph-level comments and strikethroughs
create table if not exists markups (
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

-- signatures: add revision column if missing
alter table signatures add column if not exists revision integer not null default 1;

-- proposals: drop columns moved to proposal_revisions
alter table proposals drop column if exists body;
alter table proposals drop column if exists file_url;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with project `bkhbbcttqprkirzpvnpf` and the SQL above.

- [ ] **Step 3: Verify tables exist**

```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```
Expected: `clicks`, `links`, `markups`, `profiles`, `proposal_revisions`, `proposals`, `signatures`

- [ ] **Step 4: Generate TypeScript types**

Use `mcp__claude_ai_Supabase__generate_typescript_types` for project `bkhbbcttqprkirzpvnpf`. Save output to `types/supabase.ts`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_profiles_revisions_markups.sql types/supabase.ts
git commit -m "feat: add profiles, proposal_revisions, markups tables; generate types"
```

---

### Task 3: lib/env.ts + instrumentation.ts

**Files:**
- Create: `lib/env.ts`
- Create: `instrumentation.ts`

- [ ] **Step 1: Write lib/env.ts**

```typescript
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_STARTER_PRICE_ID',
  'STRIPE_PRO_PRICE_ID',
  'NEXT_PUBLIC_APP_URL',
] as const

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  resendApiKey: process.env.RESEND_API_KEY!,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  stripeStarterPriceId: process.env.STRIPE_STARTER_PRICE_ID!,
  stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
}
```

- [ ] **Step 2: Write instrumentation.ts**

```typescript
export async function register() {
  await import('./lib/env')
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/env.ts instrumentation.ts
git commit -m "feat: env validation at startup via instrumentation.ts"
```

---

### Task 4: lib/supabase/service.ts

**Files:**
- Create: `lib/supabase/service.ts`

- [ ] **Step 1: Write service.ts**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/service.ts
git commit -m "feat: add service role Supabase client"
```

---

### Task 5: Rename proxy.ts → middleware.ts, protect /dashboard/*

**Files:**
- Delete: `proxy.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Write middleware.ts**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isDashboard = path.startsWith('/dashboard')
  const isAuthPage = path === '/login' || path === '/signup'

  if (!user && isDashboard) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/links'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Delete proxy.ts**

```bash
git rm proxy.ts
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: rename proxy.ts to middleware.ts, protect /dashboard/* routes"
```

---

### Task 6: Routing restructure — pages to /dashboard/ prefix

**Files:**
- Modify: `app/(dashboard)/page.tsx` — redirect to /dashboard/links
- Modify: `app/(dashboard)/layout.tsx` — dark sidebar, correct nav hrefs
- Create: `app/(dashboard)/dashboard/links/page.tsx`
- Create: `app/(dashboard)/dashboard/links/new/page.tsx`
- Create: `app/(dashboard)/dashboard/links/[id]/page.tsx`
- Create: `app/(dashboard)/dashboard/proposals/page.tsx`
- Create: `app/(dashboard)/dashboard/proposals/new/page.tsx`
- Create: `app/(dashboard)/dashboard/billing/page.tsx`
- Create: `app/(dashboard)/dashboard/settings/page.tsx`

- [ ] **Step 1: Update app/(dashboard)/page.tsx**

```typescript
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard/links')
}
```

- [ ] **Step 2: Update layout.tsx with dark sidebar and correct hrefs**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-white">
      <aside className="w-52 border-r flex flex-col shrink-0 bg-[#111111]">
        <div className="p-4 border-b border-neutral-800">
          <span className="font-bold text-base text-white">LinkDrop</span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          <a href="/dashboard/links" className="text-sm px-2 py-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800">Links</a>
          <a href="/dashboard/proposals" className="text-sm px-2 py-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800">Proposals</a>
          <a href="/dashboard/billing" className="text-sm px-2 py-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800">Billing</a>
          <a href="/dashboard/settings" className="text-sm px-2 py-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800">Settings</a>
        </nav>
        <div className="p-3 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 truncate mb-2">{user.email}</p>
          <form action={signOut}>
            <button type="submit" className="text-xs text-neutral-400 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Create dashboard/links/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LinksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: links } = await supabase
    .from('links')
    .select('id, slug, destination_url, active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Links</h1>
        <a href="/dashboard/links/new" className="bg-black text-white text-sm px-3 py-1.5 rounded">+ New Link</a>
      </div>
      {!links || links.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No links yet.</p>
          <a href="/dashboard/links/new" className="text-sm underline text-gray-600">Create your first link</a>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.id}>
              <a href={`/dashboard/links/${link.id}`} className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50">
                <span className="font-mono text-sm">/{link.slug}</span>
                <span className="text-xs text-gray-400">{link.active ? 'active' : 'inactive'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create dashboard/links/new/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function NewLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: formError } = await searchParams

  async function createLink(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const slug = (formData.get('slug') as string).trim().toLowerCase()
    const destinationUrl = (formData.get('destination_url') as string).trim()
    const notifyOnFirstClick = formData.get('notify_on_first_click') === 'on'

    const { data, error } = await supabase
      .from('links')
      .insert({ user_id: user.id, slug, destination_url: destinationUrl, notify_on_first_click: notifyOnFirstClick })
      .select('id')
      .single()

    if (error || !data) {
      redirect(`/dashboard/links/new?error=${encodeURIComponent(
        error?.code === '23505' ? 'That slug is already taken.' : (error?.message ?? 'Unknown error')
      )}`)
    }
    redirect(`/dashboard/links/${data.id}`)
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-6">New Link</h1>
      {formError && <p className="text-sm text-red-600 mb-4">{formError}</p>}
      <form action={createLink} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Slug</label>
          <div className="flex items-center border rounded overflow-hidden">
            <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r font-mono">linkdrop.io/</span>
            <input name="slug" type="text" placeholder="your-slug" required pattern="[a-z0-9\-]+"
              className="flex-1 px-3 py-2 text-sm outline-none font-mono" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Destination URL</label>
          <input name="destination_url" type="url" placeholder="https://example.com" required
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="notify_on_first_click" type="checkbox" defaultChecked />
          Email me on first click
        </label>
        <div className="flex gap-2">
          <button type="submit" className="bg-black text-white text-sm px-4 py-2 rounded">Create Link</button>
          <a href="/dashboard/links" className="text-sm px-4 py-2 rounded border hover:bg-gray-50">Cancel</a>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Create dashboard/links/[id]/page.tsx**

```typescript
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function LinkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: link } = await supabase.from('links').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!link) notFound()

  const { data: clicks } = await supabase
    .from('clicks')
    .select('id, clicked_at, user_agent, referrer')
    .eq('link_id', id)
    .order('clicked_at', { ascending: false })

  return (
    <div className="max-w-2xl">
      <div className="mb-6"><a href="/dashboard/links" className="text-sm text-gray-400 hover:underline">← Links</a></div>
      <h1 className="text-xl font-semibold mb-1 font-mono">/{link.slug}</h1>
      <p className="text-sm text-gray-500 mb-6">{link.destination_url}</p>
      <h2 className="text-sm font-medium mb-3">Clicks ({clicks?.length ?? 0})</h2>
      {!clicks || clicks.length === 0 ? (
        <p className="text-sm text-gray-400">No clicks yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clicks.map((click) => (
            <li key={click.id} className="text-xs font-mono text-gray-600 border rounded px-3 py-2">
              {new Date(click.clicked_at).toISOString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create dashboard/proposals/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProposalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Proposals</h1>
        <a href="/dashboard/proposals/new" className="bg-black text-white text-sm px-3 py-1.5 rounded">+ New Proposal</a>
      </div>
      {!proposals || proposals.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No proposals yet.</p>
          <a href="/dashboard/proposals/new" className="text-sm underline text-gray-600">Create your first proposal</a>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {proposals.map((p) => (
            <li key={p.id}>
              <a href={`/dashboard/proposals/${p.id}`} className="flex items-center justify-between border rounded-lg px-4 py-3 hover:bg-gray-50">
                <span className="text-sm font-medium">{p.title}</span>
                <span className="text-xs text-gray-400 font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Create dashboard/billing/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  const plan = profile?.plan ?? 'free'

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-6">Billing</h1>
      <div className="border rounded-lg p-4 mb-4">
        <p className="text-sm text-gray-500 mb-1">Current plan</p>
        <p className="text-lg font-semibold capitalize">{plan}</p>
      </div>
      {plan === 'free' && (
        <div className="flex flex-col gap-2">
          <a href="/api/billing/checkout?plan=starter" className="bg-black text-white text-sm px-4 py-2 rounded text-center">Upgrade to Starter</a>
          <a href="/api/billing/checkout?plan=pro" className="border text-sm px-4 py-2 rounded text-center hover:bg-gray-50">Upgrade to Pro</a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Create dashboard/settings/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('full_name, custom_domain').eq('id', user.id).single()

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>
      <div className="border rounded-lg p-4 mb-4">
        <p className="text-sm font-medium mb-1">Email</p>
        <p className="text-sm text-gray-500">{user.email}</p>
      </div>
      <div className="border rounded-lg p-4 mb-4">
        <p className="text-sm font-medium mb-1">Custom Domain</p>
        <p className="text-sm text-gray-400">Coming soon — enter your domain and we'll reach out with setup instructions.</p>
        <input type="text" defaultValue={profile?.custom_domain ?? ''} placeholder="yourdomain.com" disabled
          className="mt-2 w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-400" />
      </div>
      <div className="border rounded-lg p-4">
        <p className="text-sm font-medium mb-1">Team</p>
        <p className="text-sm text-gray-400">Coming soon.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Remove old route files if present**

```bash
# Remove old /links/* routes that were at (dashboard)/links/ (not /dashboard/links/)
rm -rf app/\(dashboard\)/links 2>/dev/null || true
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: restructure routes to /dashboard/* prefix, dark sidebar"
```

---

### Task 7: lib/slug.ts + tests

**Files:**
- Create: `lib/slug.ts`
- Create: `__tests__/slug.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/slug.test.ts
import { describe, it, expect, vi } from 'vitest'
import { generateSlug, resolveSlug } from '@/lib/slug'

describe('generateSlug', () => {
  it('generates 6-char alphanumeric slug', () => {
    const slug = generateSlug()
    expect(slug).toMatch(/^[a-z0-9]{6}$/)
  })

  it('uses custom length', () => {
    expect(generateSlug(8)).toHaveLength(8)
  })
})

describe('resolveSlug', () => {
  it('returns base slug if not taken', async () => {
    const checkExists = vi.fn().mockResolvedValue(false)
    const result = await resolveSlug('abc123', checkExists)
    expect(result).toBe('abc123')
    expect(checkExists).toHaveBeenCalledWith('abc123')
  })

  it('appends digit if base is taken', async () => {
    const checkExists = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    const result = await resolveSlug('abc123', checkExists)
    expect(result).toMatch(/^abc123[0-9]$/)
  })

  it('returns null if base and retry both taken', async () => {
    const checkExists = vi.fn().mockResolvedValue(true)
    const result = await resolveSlug('abc123', checkExists)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — verify fail**

```bash
npx vitest run __tests__/slug.test.ts 2>&1 | tail -5
```
Expected: FAIL (cannot find module '@/lib/slug')

- [ ] **Step 3: Write lib/slug.ts**

```typescript
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function generateSlug(length = 6): string {
  return Array.from(
    { length },
    () => CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

export async function resolveSlug(
  base: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string | null> {
  if (!(await checkExists(base))) return base
  const retry = base + Math.floor(Math.random() * 10).toString()
  if (!(await checkExists(retry))) return retry
  return null
}
```

- [ ] **Step 4: Run test — verify pass**

```bash
npx vitest run __tests__/slug.test.ts
```
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/slug.ts __tests__/slug.test.ts
git commit -m "feat: slug generation and collision resolution with tests"
```

---

### Task 8: lib/limits.ts + tests

**Files:**
- Create: `lib/limits.ts`
- Create: `__tests__/limits.test.ts`

- [ ] **Step 1: Write lib/limits.ts**

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export const PLAN_LIMITS = {
  free:    { links: 5,        proposals: 0         },
  starter: { links: 25,       proposals: 5         },
  pro:     { links: Infinity, proposals: Infinity  },
} as const

export type Plan = keyof typeof PLAN_LIMITS

export async function getPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  return (data?.plan as Plan) ?? 'free'
}

export async function checkLinkLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: Plan }> {
  const plan = await getPlan(supabase, userId)
  const limit = PLAN_LIMITS[plan].links
  if (limit === Infinity) return { allowed: true, plan }

  const result = await supabase
    .from('links')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('active', true)
  const count = result.count ?? 0

  return { allowed: count < limit, plan }
}

export async function checkProposalLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; plan: Plan }> {
  const plan = await getPlan(supabase, userId)
  const limit = PLAN_LIMITS[plan].proposals
  if (limit === Infinity) return { allowed: true, plan }
  if (limit === 0) return { allowed: false, plan }

  const result = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const count = result.count ?? 0

  return { allowed: count < limit, plan }
}

export function signaturesEnabled(plan: Plan): boolean {
  return plan === 'starter' || plan === 'pro'
}
```

- [ ] **Step 2: Write __tests__/limits.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { PLAN_LIMITS, signaturesEnabled } from '@/lib/limits'

describe('PLAN_LIMITS', () => {
  it('free: 5 links, 0 proposals', () => {
    expect(PLAN_LIMITS.free.links).toBe(5)
    expect(PLAN_LIMITS.free.proposals).toBe(0)
  })

  it('starter: 25 links, 5 proposals', () => {
    expect(PLAN_LIMITS.starter.links).toBe(25)
    expect(PLAN_LIMITS.starter.proposals).toBe(5)
  })

  it('pro: unlimited links and proposals', () => {
    expect(PLAN_LIMITS.pro.links).toBe(Infinity)
    expect(PLAN_LIMITS.pro.proposals).toBe(Infinity)
  })
})

describe('signaturesEnabled', () => {
  it('disabled for free', () => expect(signaturesEnabled('free')).toBe(false))
  it('enabled for starter', () => expect(signaturesEnabled('starter')).toBe(true))
  it('enabled for pro', () => expect(signaturesEnabled('pro')).toBe(true))
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run __tests__/limits.test.ts
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add lib/limits.ts __tests__/limits.test.ts
git commit -m "feat: plan limit checks with tests"
```

---

### Task 9: /api/links route

**Files:**
- Create: `app/api/links/route.ts`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkLinkLimit } from '@/lib/limits'
import { generateSlug, resolveSlug } from '@/lib/slug'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('links')
    .select('id, slug, destination_url, active, notify_on_first_click, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkLinkLimit(supabase, user.id)
  if (!allowed) return NextResponse.json({ error: 'plan_limit_reached' }, { status: 403 })

  const body = await request.json()
  let { slug, destination_url, notify_on_first_click = true } = body

  if (!destination_url) return NextResponse.json({ error: 'destination_url required' }, { status: 400 })

  if (!slug) {
    const checkExists = async (s: string) => {
      const { data } = await supabase.from('links').select('id').eq('slug', s).single()
      return !!data
    }
    const resolved = await resolveSlug(generateSlug(), checkExists)
    if (!resolved) return NextResponse.json({ error: 'Could not generate unique slug. Try a custom slug.' }, { status: 409 })
    slug = resolved
  }

  const { data, error } = await supabase
    .from('links')
    .insert({ user_id: user.id, slug, destination_url, notify_on_first_click })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already taken.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, active } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase.from('links').update({ active }).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/links/route.ts
git commit -m "feat: /api/links GET/POST/PATCH with plan limit enforcement"
```

---

### Task 10: lib/track.ts + /api/track + tests

**Files:**
- Create: `lib/track.ts`
- Create: `app/api/track/route.ts`
- Create: `__tests__/track.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/track.test.ts
import { describe, it, expect } from 'vitest'
import { hashIp, buildClickRecord } from '@/lib/track'

describe('hashIp', () => {
  it('returns 64-char hex string', () => {
    expect(hashIp('1.2.3.4')).toMatch(/^[a-f0-9]{64}$/)
  })

  it('consistent for same IP', () => {
    expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'))
  })

  it('different hash for different IPs', () => {
    expect(hashIp('1.2.3.4')).not.toBe(hashIp('5.6.7.8'))
  })

  it('returns null for empty/null', () => {
    expect(hashIp(null)).toBeNull()
    expect(hashIp('')).toBeNull()
  })
})

describe('buildClickRecord', () => {
  it('hashes IP, includes required fields, no raw ip', () => {
    const record = buildClickRecord({ linkId: 'link-1', ip: '1.2.3.4', userAgent: 'Mozilla', referrer: 'https://x.com' })
    expect(record.link_id).toBe('link-1')
    expect(record.ip_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(record.user_agent).toBe('Mozilla')
    expect(record).not.toHaveProperty('ip')
  })
})
```

- [ ] **Step 2: Run test — verify fail**

```bash
npx vitest run __tests__/track.test.ts 2>&1 | tail -3
```

- [ ] **Step 3: Write lib/track.ts**

```typescript
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  return createHash('sha256').update(ip).digest('hex')
}

export function buildClickRecord({
  linkId,
  ip,
  userAgent,
  referrer,
}: {
  linkId: string
  ip: string | null
  userAgent: string | null
  referrer: string | null
}) {
  return {
    link_id: linkId,
    ip_hash: hashIp(ip),
    user_agent: userAgent,
    referrer,
  }
}

export async function logClick({
  linkId,
  ip,
  userAgent,
  referrer,
}: {
  linkId: string
  ip: string | null
  userAgent: string | null
  referrer: string | null
}): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('clicks').insert(buildClickRecord({ linkId, ip, userAgent, referrer }))
}

export async function getClickCount(linkId: string): Promise<number> {
  const supabase = createServiceClient()
  const result = await supabase
    .from('clicks')
    .select('id', { count: 'exact', head: true })
    .eq('link_id', linkId)
  return result.count ?? 0
}
```

- [ ] **Step 4: Write /api/track/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logClick, getClickCount } from '@/lib/track'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { link_id } = body
  if (!link_id) return NextResponse.json({ error: 'link_id required' }, { status: 400 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = request.headers.get('user-agent')
  const referrer = request.headers.get('referer')

  const prevCount = await getClickCount(link_id)
  await logClick({ linkId: link_id, ip, userAgent, referrer })

  if (prevCount === 0) {
    const supabase = createServiceClient()
    const { data: link } = await supabase
      .from('links')
      .select('notify_on_first_click, slug, user_id')
      .eq('id', link_id)
      .single()

    if (link?.notify_on_first_click) {
      const { data: { user } } = await supabase.auth.admin.getUserById(link.user_id)
      if (user?.email) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'noreply@linkdrop.io',
          to: user.email,
          subject: `Someone opened your link — ${link.slug}`,
          text: `Your link /${link.slug} was opened at ${new Date().toISOString()}.\n\nView: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/links`,
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run __tests__/track.test.ts
```
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add lib/track.ts app/api/track/route.ts __tests__/track.test.ts
git commit -m "feat: click tracking with IP hashing and first-click email"
```

---

### Task 11: Update app/[slug]/page.tsx

**Files:**
- Modify: `app/[slug]/page.tsx`

- [ ] **Step 1: Rewrite [slug]/page.tsx**

```typescript
import { notFound, redirect } from 'next/navigation'
import { after } from 'next/server'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { logClick } from '@/lib/track'

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: link } = await supabase
    .from('links')
    .select('id, destination_url, proposal_id, active')
    .eq('slug', slug)
    .single()

  if (!link || !link.active) notFound()

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = headersList.get('user-agent')
  const referrer = headersList.get('referer')

  after(() => logClick({ linkId: link.id, ip, userAgent, referrer }))

  if (link.proposal_id) {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('id, title, user_id')
      .eq('id', link.proposal_id)
      .single()

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('hide_branding')
      .eq('id', proposal?.user_id ?? '')
      .single()

    return (
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-semibold">{proposal?.title ?? 'Proposal'}</h1>
        <p className="text-sm text-gray-400 mt-2">Full proposal viewer available after sign page is built.</p>
        {!ownerProfile?.hide_branding && (
          <p className="text-xs text-gray-400 text-center mt-8">
            Powered by <a href="https://linkdrop.io" className="underline">LinkDrop</a>
          </p>
        )}
      </div>
    )
  }

  redirect(link.destination_url!)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\[slug\]/page.tsx
git commit -m "feat: slug redirect route with fire-and-forget click tracking via after()"
```

---

### Task 12: /api/proposals route

**Files:**
- Create: `app/api/proposals/route.ts`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkProposalLimit } from '@/lib/limits'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('proposals')
    .select('id, title, logo_url, signature_required, expires_at, created_at, proposal_revisions(id, revision, created_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkProposalLimit(supabase, user.id)
  if (!allowed) return NextResponse.json({ error: 'plan_limit_reached' }, { status: 403 })

  const body = await request.json()
  const { title, body: proposalBody, logo_url, signature_required = true, expires_at } = body

  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (!proposalBody) return NextResponse.json({ error: 'body required' }, { status: 400 })

  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .insert({ user_id: user.id, title, logo_url, signature_required, expires_at })
    .select('id')
    .single()

  if (proposalError || !proposal) {
    return NextResponse.json({ error: proposalError?.message ?? 'Failed to create proposal' }, { status: 500 })
  }

  const { error: revisionError } = await supabase
    .from('proposal_revisions')
    .insert({ proposal_id: proposal.id, revision: 1, body: proposalBody })

  if (revisionError) return NextResponse.json({ error: revisionError.message }, { status: 500 })

  return NextResponse.json({ id: proposal.id }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, body: revisionBody } = body
  if (!id || !revisionBody) return NextResponse.json({ error: 'id and body required' }, { status: 400 })

  const { data: proposal } = await supabase.from('proposals').select('id').eq('id', id).eq('user_id', user.id).single()
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: latest } = await supabase
    .from('proposal_revisions')
    .select('revision')
    .eq('proposal_id', id)
    .order('revision', { ascending: false })
    .limit(1)
    .single()

  const nextRevision = (latest?.revision ?? 0) + 1
  const { error } = await supabase.from('proposal_revisions').insert({ proposal_id: id, revision: nextRevision, body: revisionBody })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ revision: nextRevision })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/proposals/route.ts
git commit -m "feat: /api/proposals GET/POST/PUT with revision support and plan limits"
```

---

### Task 13: Proposal builder UI

**Files:**
- Create: `app/(dashboard)/dashboard/proposals/new/page.tsx`

- [ ] **Step 1: Write page**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkProposalLimit } from '@/lib/limits'

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error: formError } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { allowed, plan } = await checkProposalLimit(supabase, user.id)

  if (!allowed) {
    return (
      <div className="max-w-md">
        <h1 className="text-xl font-semibold mb-4">New Proposal</h1>
        <div className="border rounded-lg p-4 bg-amber-50">
          <p className="text-sm text-amber-800 mb-2">
            {plan === 'free'
              ? 'Proposals require a Starter plan or higher.'
              : "You've reached your proposal limit."}
          </p>
          <a href="/dashboard/billing" className="text-sm font-medium text-amber-900 underline">Upgrade your plan</a>
        </div>
      </div>
    )
  }

  async function createProposal(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const title = (formData.get('title') as string).trim()
    const body = (formData.get('body') as string).trim()
    const signatureRequired = formData.get('signature_required') === 'on'

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, signature_required: signatureRequired }),
    })

    const data = await res.json()
    if (!res.ok) {
      redirect(`/dashboard/proposals/new?error=${encodeURIComponent(data.error ?? 'Failed')}`)
    }
    redirect(`/dashboard/proposals/${data.id}`)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">New Proposal</h1>
      {formError && <p className="text-sm text-red-600 mb-4">{formError}</p>}
      <form action={createProposal} className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-1">Title</label>
          <input name="title" type="text" placeholder="Project proposal" required className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Content (Markdown)</label>
          <textarea name="body" rows={16} placeholder="## Overview&#10;&#10;Write your proposal here..." required
            className="w-full border rounded px-3 py-2 text-sm font-mono resize-y" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="signature_required" type="checkbox" defaultChecked />
          Require e-signature
        </label>
        <div className="flex gap-2">
          <button type="submit" className="bg-black text-white text-sm px-4 py-2 rounded">Create Proposal</button>
          <a href="/dashboard/proposals" className="text-sm px-4 py-2 rounded border hover:bg-gray-50">Cancel</a>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/dashboard/proposals/new/page.tsx
git commit -m "feat: proposal builder UI with plan gate"
```

---

### Task 14: /api/markups route

**Files:**
- Create: `app/api/markups/route.ts`

- [ ] **Step 1: Write route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { proposal_id, revision, paragraph_index, markup_type, comment_text, author_role } = body

  if (!proposal_id || revision == null || paragraph_index == null || !markup_type || !author_role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('markups')
    .insert({ proposal_id, revision, paragraph_index, markup_type, comment_text, author_role })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (author_role === 'recipient') {
    const { data: proposal } = await supabase.from('proposals').select('title, user_id').eq('id', proposal_id).single()
    if (proposal) {
      const { data: { user } } = await supabase.auth.admin.getUserById(proposal.user_id)
      if (user?.email) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: 'noreply@linkdrop.io',
          to: user.email,
          subject: `New markup on "${proposal.title}"`,
          text: `Someone ${markup_type === 'comment' ? 'left a comment' : 'struck through a paragraph'} on your proposal.\n\nView: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/proposals/${proposal_id}`,
        })
      }
    }
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, reply_text } = body
  if (!id || !reply_text) return NextResponse.json({ error: 'id and reply_text required' }, { status: 400 })

  const serviceSupabase = createServiceClient()
  const { data: markup } = await serviceSupabase.from('markups').select('proposal_id').eq('id', id).single()
  if (!markup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: proposal } = await supabase.from('proposals').select('id').eq('id', markup.proposal_id).eq('user_id', user.id).single()
  if (!proposal) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await serviceSupabase.from('markups').update({ reply_text }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/markups/route.ts
git commit -m "feat: /api/markups POST/PATCH with sender email notification"
```

---

### Task 15: SignatureCanvas + /[slug]/sign page

**Files:**
- Create: `components/SignatureCanvas.tsx`
- Create: `app/[slug]/sign/page.tsx`

- [ ] **Step 1: Write components/SignatureCanvas.tsx**

```typescript
'use client'

import { useRef, useState } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'

interface Props {
  linkId: string
  proposalId: string
  revision: number
  slug: string
}

export default function SignatureCanvas({ linkId, proposalId, revision, slug }: Props) {
  const canvasRef = useRef<ReactSignatureCanvas>(null)
  const [useTyped, setUseTyped] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function getSignatureData(): string | null {
    if (useTyped) {
      if (!typedName.trim()) return null
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 100
      const ctx = canvas.getContext('2d')!
      ctx.font = 'italic 32px Georgia, serif'
      ctx.fillStyle = '#1a1a1a'
      ctx.fillText(typedName.trim(), 20, 60)
      return canvas.toDataURL('image/png')
    }
    if (!canvasRef.current || canvasRef.current.isEmpty()) return null
    return canvasRef.current.toDataURL('image/png')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!signerName.trim()) { setError('Name is required.'); return }
    if (!signerEmail.trim()) { setError('Email is required.'); return }
    const sig = getSignatureData()
    if (!sig) { setError(useTyped ? 'Please type your name.' : 'Please draw your signature.'); return }

    setSubmitting(true)
    const res = await fetch('/api/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signer_name: signerName, signer_email: signerEmail, link_id: linkId, proposal_id: proposalId, revision, signature_data: sig }),
    })

    if (res.ok) {
      window.location.href = `/${slug}?signed=true`
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to submit signature.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium block mb-1">Full Name</label>
        <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)} required
          className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium block mb-1">Email</label>
        <input type="email" value={signerEmail} onChange={e => setSignerEmail(e.target.value)} required
          className="w-full border rounded px-3 py-2 text-sm" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">Signature</label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input type="checkbox" checked={useTyped} onChange={e => setUseTyped(e.target.checked)} />
            I prefer to type my name
          </label>
        </div>
        {useTyped ? (
          <input type="text" placeholder="Type your full name" value={typedName}
            onChange={e => setTypedName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-2xl font-serif italic h-16" />
        ) : (
          <div className="border rounded bg-white">
            <ReactSignatureCanvas ref={canvasRef} penColor="#1a1a1a"
              canvasProps={{ className: 'w-full h-32', style: { touchAction: 'none' } }} />
            <button type="button" onClick={() => canvasRef.current?.clear()}
              className="text-xs text-gray-400 px-2 py-1 border-t w-full text-right hover:bg-gray-50">
              Clear
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={submitting}
        className="bg-black text-white text-sm px-4 py-2 rounded disabled:opacity-50">
        {submitting ? 'Submitting...' : 'Sign Document'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Write app/[slug]/sign/page.tsx**

```typescript
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import SignatureCanvas from '@/components/SignatureCanvas'

export default async function SignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createServiceClient()

  const { data: link } = await supabase
    .from('links')
    .select('id, proposal_id, active')
    .eq('slug', slug)
    .single()

  if (!link || !link.active || !link.proposal_id) notFound()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, signature_required')
    .eq('id', link.proposal_id)
    .single()

  if (!proposal || !proposal.signature_required) notFound()

  const { data: latestRevision } = await supabase
    .from('proposal_revisions')
    .select('revision, body')
    .eq('proposal_id', proposal.id)
    .order('revision', { ascending: false })
    .limit(1)
    .single()

  if (!latestRevision) notFound()

  const { data: existingSig } = await supabase
    .from('signatures')
    .select('id')
    .eq('proposal_id', proposal.id)
    .eq('link_id', link.id)
    .limit(1)
    .single()

  if (existingSig) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center">
        <h1 className="text-xl font-semibold mb-2">Already Signed</h1>
        <p className="text-sm text-gray-500">This document has already been signed.</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-xl font-semibold mb-1">{proposal.title}</h1>
      <p className="text-sm text-gray-500 mb-6">Review and sign below to accept.</p>
      <SignatureCanvas
        linkId={link.id}
        proposalId={proposal.id}
        revision={latestRevision.revision}
        slug={slug}
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/SignatureCanvas.tsx app/\[slug\]/sign/page.tsx
git commit -m "feat: SignatureCanvas component and public sign page"
```

---

### Task 16: lib/pdf.ts + /api/sign + pdf tests

**Files:**
- Create: `lib/pdf.ts`
- Create: `app/api/sign/route.ts`
- Create: `__tests__/pdf.test.ts`

- [ ] **Step 1: Write lib/pdf.ts**

```typescript
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import React from 'react'

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: '#1a1a1a', lineHeight: 1.6 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 24 },
  body: { marginBottom: 32 },
  hr: { borderBottom: '1pt solid #e5e5e5', marginBottom: 16 },
  sigLabel: { fontSize: 9, color: '#737373', marginBottom: 4 },
  sigValue: { fontSize: 11 },
  sigRow: { marginBottom: 8 },
})

export async function renderSignedPDF({
  title,
  body,
  signerName,
  signerEmail,
  signedAt,
}: {
  title: string
  body: string
  signerName: string
  signerEmail: string
  signedAt: string
}): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    {},
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, title),
      React.createElement(Text, { style: styles.body }, body),
      React.createElement(View, { style: styles.hr }),
      React.createElement(View, { style: styles.sigRow },
        React.createElement(Text, { style: styles.sigLabel }, 'Signed by'),
        React.createElement(Text, { style: styles.sigValue }, signerName),
      ),
      React.createElement(View, { style: styles.sigRow },
        React.createElement(Text, { style: styles.sigLabel }, 'Email'),
        React.createElement(Text, { style: styles.sigValue }, signerEmail),
      ),
      React.createElement(View, { style: styles.sigRow },
        React.createElement(Text, { style: styles.sigLabel }, 'Signed at'),
        React.createElement(Text, { style: styles.sigValue }, signedAt),
      ),
    )
  )

  const buffer = await renderToBuffer(doc)
  return Buffer.from(buffer)
}
```

- [ ] **Step 2: Write __tests__/pdf.test.ts**

```typescript
import { describe, it, expect } from 'vitest'
import { renderSignedPDF } from '@/lib/pdf'

describe('renderSignedPDF', () => {
  it('returns a Buffer', async () => {
    const result = await renderSignedPDF({
      title: 'Test Proposal',
      body: 'This is the proposal body.',
      signerName: 'Jane Smith',
      signerEmail: 'jane@example.com',
      signedAt: '2026-06-01T12:00:00Z',
    })
    expect(Buffer.isBuffer(result)).toBe(true)
  }, 15000)

  it('produces non-empty PDF (>1KB)', async () => {
    const result = await renderSignedPDF({
      title: 'Another Proposal',
      body: 'Body text.',
      signerName: 'John Doe',
      signerEmail: 'john@example.com',
      signedAt: '2026-06-01T12:00:00Z',
    })
    expect(result.length).toBeGreaterThan(1000)
  }, 15000)
})
```

- [ ] **Step 3: Run PDF tests**

```bash
npx vitest run __tests__/pdf.test.ts --timeout 30000
```
Expected: both PASS

- [ ] **Step 4: Write /api/sign/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { renderSignedPDF } from '@/lib/pdf'
import { hashIp } from '@/lib/track'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { signer_name, signer_email, link_id, proposal_id, revision, signature_data } = body

  if (!signer_name || !signer_email || !link_id || !proposal_id || !revision || !signature_data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: existing } = await supabase.from('signatures').select('id').eq('proposal_id', proposal_id).eq('link_id', link_id).single()
  if (existing) return NextResponse.json({ error: 'Already signed' }, { status: 409 })

  const { data: revisionData } = await supabase.from('proposal_revisions').select('body').eq('proposal_id', proposal_id).eq('revision', revision).single()
  const { data: proposal } = await supabase.from('proposals').select('title, user_id').eq('id', proposal_id).single()

  if (!revisionData || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  const signedAt = new Date().toISOString()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  const sigBuffer = Buffer.from(signature_data.replace(/^data:image\/png;base64,/, ''), 'base64')
  await supabase.storage.from('signatures').upload(`${proposal_id}/${link_id}-sig.png`, sigBuffer, { contentType: 'image/png', upsert: true })

  const pdfBuffer = await renderSignedPDF({ title: proposal.title, body: revisionData.body, signerName: signer_name, signerEmail: signer_email, signedAt })
  const pdfPath = `${proposal_id}/${link_id}-signed.pdf`
  await supabase.storage.from('signatures').upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  const { data: pdfUrlData } = await supabase.storage.from('signatures').createSignedUrl(pdfPath, 60 * 60 * 24 * 7)

  await supabase.from('signatures').insert({ proposal_id, link_id, revision, signer_name, signer_email, signature_data, ip_hash: hashIp(ip) })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: { user: owner } } = await supabase.auth.admin.getUserById(proposal.user_id)
  const pdfLink = pdfUrlData?.signedUrl ?? ''

  await Promise.all([
    owner?.email && resend.emails.send({
      from: 'noreply@linkdrop.io',
      to: owner.email,
      subject: `"${proposal.title}" has been signed`,
      text: `${signer_name} (${signer_email}) signed at ${signedAt}.\n\nDownload: ${pdfLink}`,
    }),
    resend.emails.send({
      from: 'noreply@linkdrop.io',
      to: signer_email,
      subject: `Your signed copy of "${proposal.title}"`,
      text: `Thank you for signing. Download your copy: ${pdfLink}`,
    }),
  ])

  return NextResponse.json({ ok: true, pdf_url: pdfLink })
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/pdf.ts app/api/sign/route.ts __tests__/pdf.test.ts
git commit -m "feat: PDF generation, /api/sign with storage and email confirmation"
```

---

### Task 17: Proposal detail page

**Files:**
- Create: `app/(dashboard)/dashboard/proposals/[id]/page.tsx`

- [ ] **Step 1: Write page**

```typescript
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, title, signature_required, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!proposal) notFound()

  const serviceSupabase = createServiceClient()

  const [{ data: revisions }, { data: signatures }, { data: markups }] = await Promise.all([
    serviceSupabase.from('proposal_revisions').select('id, revision, created_at').eq('proposal_id', id).order('revision', { ascending: false }),
    serviceSupabase.from('signatures').select('id, signer_name, signer_email, signed_at, revision').eq('proposal_id', id).order('signed_at', { ascending: false }),
    serviceSupabase.from('markups').select('id, paragraph_index, markup_type, comment_text, reply_text, author_role, created_at, revision').eq('proposal_id', id).order('created_at', { ascending: true }),
  ])

  return (
    <div className="max-w-3xl">
      <div className="mb-6"><a href="/dashboard/proposals" className="text-sm text-gray-400 hover:underline">← Proposals</a></div>
      <h1 className="text-xl font-semibold mb-1">{proposal.title}</h1>
      <p className="text-xs text-gray-400 font-mono mb-6">{new Date(proposal.created_at).toISOString()}</p>

      <div className="mb-8">
        <h2 className="text-sm font-medium mb-3">Revisions ({revisions?.length ?? 0})</h2>
        <ul className="flex flex-col gap-1">
          {revisions?.map((r) => (
            <li key={r.id} className="text-xs font-mono text-gray-600 border rounded px-3 py-2 flex justify-between">
              <span>v{r.revision}</span>
              <span>{new Date(r.created_at).toISOString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-8">
        <h2 className="text-sm font-medium mb-3">Signatures ({signatures?.length ?? 0})</h2>
        {!signatures || signatures.length === 0 ? (
          <p className="text-sm text-gray-400">{proposal.signature_required ? 'Not yet signed.' : 'No signature required.'}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {signatures.map((sig) => (
              <li key={sig.id} className="border rounded px-3 py-2">
                <p className="text-sm font-medium">{sig.signer_name}</p>
                <p className="text-xs text-gray-500">{sig.signer_email}</p>
                <p className="text-xs font-mono text-gray-400">{new Date(sig.signed_at).toISOString()} · v{sig.revision}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">Markups ({markups?.length ?? 0})</h2>
        {!markups || markups.length === 0 ? (
          <p className="text-sm text-gray-400">No markups yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {markups.map((m) => (
              <li key={m.id} className="border rounded px-3 py-2">
                <p className="text-xs text-gray-400 mb-1">¶{m.paragraph_index} · {m.markup_type} · {m.author_role}</p>
                {m.comment_text && <p className="text-sm">{m.comment_text}</p>}
                {m.reply_text && <p className="text-sm text-gray-500 border-l-2 pl-2 mt-1">Reply: {m.reply_text}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/dashboard/proposals/\[id\]/page.tsx
git commit -m "feat: proposal detail page with revisions, signatures, markups"
```

---

### Task 18: Stripe webhook + billing checkout + PlanGate

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`
- Create: `app/api/billing/checkout/route.ts`
- Create: `components/PlanGate.tsx`

- [ ] **Step 1: Write Stripe webhook handler**

```typescript
// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id

    if (userId) {
      const session2 = await new Stripe(process.env.STRIPE_SECRET_KEY!).checkout.sessions.retrieve(session.id, { expand: ['line_items'] })
      const priceId = session2.line_items?.data?.[0]?.price?.id

      const plan =
        priceId === process.env.STRIPE_PRO_PRICE_ID ? 'pro' :
        priceId === process.env.STRIPE_STARTER_PRICE_ID ? 'starter' : null

      if (plan) {
        await supabase.from('profiles').update({
          plan,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          hide_branding: plan === 'pro',
        }).eq('id', userId)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await supabase.from('profiles').update({ plan: 'free', hide_branding: false }).eq('stripe_subscription_id', sub.id)
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 2: Write /api/billing/checkout/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const plan = request.nextUrl.searchParams.get('plan')
  const priceId =
    plan === 'pro' ? process.env.STRIPE_PRO_PRICE_ID :
    plan === 'starter' ? process.env.STRIPE_STARTER_PRICE_ID : null

  if (!priceId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    metadata: { user_id: user.id },
  })

  return NextResponse.redirect(session.url!)
}
```

- [ ] **Step 3: Write components/PlanGate.tsx**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Plan } from '@/lib/limits'

interface Props {
  required: Plan | Plan[]
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default async function PlanGate({ required, children, fallback }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  const plan = (profile?.plan ?? 'free') as Plan
  const allowed = Array.isArray(required) ? required.includes(plan) : plan === required

  if (!allowed) return fallback ? <>{fallback}</> : null
  return <>{children}</>
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/stripe/route.ts app/api/billing/checkout/route.ts components/PlanGate.tsx
git commit -m "feat: Stripe webhook, checkout route, PlanGate component"
```

---

### Task 19: Auth confirm + Skeleton + ProposalViewer + README

**Files:**
- Create: `app/(auth)/confirm/page.tsx`
- Create: `components/Skeleton.tsx`
- Create: `components/ProposalViewer.tsx`
- Create: `README.md`

- [ ] **Step 1: Write confirm page**

```typescript
export default function ConfirmPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-semibold mb-2">Check your email</h1>
        <p className="text-sm text-gray-500">We sent you a confirmation link. Click it to finish signing in.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write components/Skeleton.tsx**

```typescript
export default function Skeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-100 rounded animate-pulse"
          style={{ width: i % 3 === 2 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write components/ProposalViewer.tsx**

```typescript
'use client'

import { useState } from 'react'

interface Markup {
  id: string
  paragraph_index: number
  markup_type: 'strikethrough' | 'comment'
  comment_text: string | null
  reply_text: string | null
  author_role: 'sender' | 'recipient'
}

interface Props {
  proposalId: string
  revision: number
  body: string
  markups: Markup[]
  canMarkup: boolean
}

export default function ProposalViewer({ proposalId, revision, body, markups, canMarkup }: Props) {
  const paragraphs = body.split('\n\n').filter(Boolean)
  const [localMarkups, setLocalMarkups] = useState<Markup[]>(markups)
  const [activeComment, setActiveComment] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')
  const [error, setError] = useState('')

  async function addMarkup(paragraphIndex: number, type: 'strikethrough' | 'comment', text?: string) {
    setError('')
    const res = await fetch('/api/markups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_id: proposalId, revision, paragraph_index: paragraphIndex, markup_type: type, comment_text: text ?? null, author_role: 'recipient' }),
    })
    if (res.ok) {
      const data = await res.json()
      setLocalMarkups(prev => [...prev, { id: data.id, paragraph_index: paragraphIndex, markup_type: type, comment_text: text ?? null, reply_text: null, author_role: 'recipient' }])
      setActiveComment(null)
      setCommentText('')
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to add markup')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {paragraphs.map((para, idx) => {
        const paraMarkups = localMarkups.filter(m => m.paragraph_index === idx)
        const isStruck = paraMarkups.some(m => m.markup_type === 'strikethrough')
        const comments = paraMarkups.filter(m => m.markup_type === 'comment')
        return (
          <div key={idx} className="group relative">
            <p className={`text-sm leading-relaxed ${isStruck ? 'line-through text-gray-400' : ''}`}>{para}</p>
            {canMarkup && !isStruck && (
              <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => addMarkup(idx, 'strikethrough')} className="text-xs text-gray-400 hover:text-gray-700 border rounded px-2 py-0.5">Strike</button>
                <button onClick={() => setActiveComment(activeComment === idx ? null : idx)} className="text-xs text-gray-400 hover:text-gray-700 border rounded px-2 py-0.5">Comment</button>
              </div>
            )}
            {activeComment === idx && (
              <div className="mt-2 flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..."
                  className="flex-1 border rounded px-2 py-1 text-sm" />
                <button onClick={() => addMarkup(idx, 'comment', commentText)} className="text-sm px-3 py-1 bg-black text-white rounded">Add</button>
              </div>
            )}
            {comments.map(c => (
              <div key={c.id} className="mt-2 border-l-2 border-amber-300 pl-3">
                <p className="text-xs text-gray-600">{c.comment_text}</p>
                {c.reply_text && <p className="text-xs text-gray-400 mt-1">↳ {c.reply_text}</p>}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Write README.md**

```markdown
# LinkDrop

Link shortener with click tracking, proposal pages, e-signatures, and document markup.

## Local Setup

### Prerequisites

- Node.js 20+
- Supabase project (see env vars)
- Stripe account
- Resend account

### Install

```bash
npm install
```

### Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_PRICE_ID=
STRIPE_PRO_PRICE_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run

```bash
npm run dev
```

### Tests

```bash
npx vitest run
```

### Stripe Webhook (local)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Architecture

- `app/(auth)/` — login, signup, confirm
- `app/(dashboard)/dashboard/` — protected dashboard routes
- `app/[slug]/` — public link redirect and proposal viewer
- `app/api/` — REST API routes
- `lib/` — slug, limits, track, pdf, env, supabase helpers
- `components/` — React components
- `__tests__/` — Vitest test suite

## Plan Limits

| | Free | Starter | Pro |
|---|---|---|---|
| Active links | 5 | 25 | Unlimited |
| Proposals | 0 | 5 | Unlimited |
| Signatures | — | ✓ | ✓ |
| Markup | — | ✓ | ✓ |
| Custom domain | — | — | Coming soon |
| Team seats | — | — | Coming soon |
```

- [ ] **Step 5: Commit**

```bash
git add app/\(auth\)/confirm/page.tsx components/Skeleton.tsx components/ProposalViewer.tsx README.md
git commit -m "feat: confirm page, Skeleton, ProposalViewer, README"
```

---

### Task 20: Run all tests + deploy

**Files:** none

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: all tests in `__tests__/slug.test.ts`, `__tests__/limits.test.ts`, `__tests__/track.test.ts`, `__tests__/pdf.test.ts` PASS

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -20
```
Expected: no errors

- [ ] **Step 3: Add env vars to Vercel if not present**

Check Vercel project settings and ensure all required env vars are set:
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `NEXT_PUBLIC_APP_URL` (set to `https://linkdropai.vercel.app` or production domain)

- [ ] **Step 4: Deploy**

```bash
git push origin main
```
Vercel will auto-deploy from the push.

- [ ] **Step 5: Smoke test deployed app**

1. Visit `/login` — confirm page loads
2. Sign up with a new email
3. Click confirmation link
4. Confirm redirect to `/dashboard/links`
5. Create a link via `/dashboard/links/new`
6. Visit `/{slug}` — confirm redirect works
7. Visit `/dashboard/billing` — confirm plan shows 'free'

---

## Self-Review

- [x] All 21 spec build steps covered across 20 tasks
- [x] No TBD/TODO placeholders — all stubs include working code
- [x] `Plan` type from `lib/limits.ts` used consistently in PlanGate, checkLinkLimit, checkProposalLimit
- [x] Supabase: server client in RSC/actions, service client in API routes
- [x] IP hashing via `hashIp()` in both lib/track.ts and /api/sign
- [x] Plan limits enforced in /api/links (POST) and /api/proposals (POST) before insert
- [x] Stripe webhook handles both `checkout.session.completed` and `customer.subscription.deleted`
- [x] 4 test files with real assertions (no empty stubs)
- [x] `after()` from `next/server` for fire-and-forget click tracking
- [x] `middleware.ts` (not proxy.ts) with /dashboard/* protection
- [x] `instrumentation.ts` imports lib/env.ts for startup validation
- [x] Branding footer gated on `hide_branding` profile field
- [x] Storage buckets referenced: `signatures` (private), `proposal-files` (private), `logos` (public)
