import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe, syncCheckoutSession, syncStripeSubscription } from "@/lib/billing/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook do Stripe nao configurado." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Assinatura do webhook invalida.",
    }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nao configurado." }, { status: 503 });

  try {
    if (event.type === "checkout.session.completed") {
      await syncCheckoutSession(supabase, event.data.object);
    }

    if (
      event.type === "customer.subscription.created"
      || event.type === "customer.subscription.updated"
      || event.type === "customer.subscription.deleted"
      || event.type === "customer.subscription.paused"
      || event.type === "customer.subscription.resumed"
    ) {
      await syncStripeSubscription({ supabase, subscription: event.data.object });
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel sincronizar a assinatura.",
    }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
