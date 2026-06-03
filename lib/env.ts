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
