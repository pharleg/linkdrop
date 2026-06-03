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
