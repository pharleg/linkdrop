# LinkDrop

Link shortener with click tracking, proposal pages, e-signatures, and document markup.

## Local Setup

### Prerequisites

- Node.js 20+
- Supabase project
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

- `app/(auth)/` — login, signup, email confirm
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
