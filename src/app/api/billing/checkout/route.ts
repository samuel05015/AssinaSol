import { NextResponse } from "next/server";
import { getBillingState } from "@/lib/billing/server";
import { isPlanId, planCatalog, trialDays } from "@/lib/billing/plans";
import { getStripe, getStripePriceId } from "@/lib/billing/stripe";
import { getAuthenticatedRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "Faca login para escolher um plano." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const plan = body.plan;
  if (!isPlanId(plan)) {
    return NextResponse.json({ error: "Escolha um plano valido." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nao configurado." }, { status: 503 });

  try {
    const billing = await getBillingState(supabase, user.id);
    if (
      billing.subscription?.provider === "stripe"
      && ["trialing", "active", "past_due"].includes(billing.status)
    ) {
      return NextResponse.json({
        error: "Voce ja possui uma assinatura Stripe. Use Gerenciar assinatura para trocar de plano.",
        manageSubscription: true,
      }, { status: 409 });
    }

    const stripe = getStripe();
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const metadata = { user_id: user.id, plan };
    const existingCustomer = billing.subscription?.providerCustomerId;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: user.id,
      customer: existingCustomer || undefined,
      customer_email: existingCustomer ? undefined : user.email,
      line_items: [{ price: getStripePriceId(plan), quantity: 1 }],
      payment_method_collection: "always",
      billing_address_collection: "auto",
      locale: "pt-BR",
      metadata,
      subscription_data: {
        trial_period_days: trialDays,
        metadata,
        description: `${planCatalog[plan].name} - ${trialDays} dias gratis, depois cobranca mensal`,
      },
      success_url: `${origin}/pagamento/confirmado?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/planos?checkout=cancelado`,
    });

    if (!session.url) throw new Error("O Stripe nao retornou a pagina de pagamento.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel abrir o pagamento no Stripe.",
    }, { status: 500 });
  }
}
