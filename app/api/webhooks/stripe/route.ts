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
      const expanded = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items'],
      })
      const priceId = expanded.line_items?.data?.[0]?.price?.id

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
    await supabase.from('profiles').update({
      plan: 'free',
      hide_branding: false,
    }).eq('stripe_subscription_id', sub.id)
  }

  return NextResponse.json({ received: true })
}
