import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlanId, type PlanId, type SubscriptionStatus } from "@/lib/billing/plans";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Configure STRIPE_SECRET_KEY na Vercel para ativar os pagamentos.");
  }

  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function getStripePriceId(plan: PlanId) {
  const priceIds: Record<PlanId, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    premium: process.env.STRIPE_PRICE_PREMIUM,
  };
  const priceId = priceIds[plan];
  if (!priceId) {
    throw new Error(`Configure o Price ID do Stripe para o plano ${plan}.`);
  }
  return priceId;
}

function toIso(timestamp: number | null | undefined, fallback = Date.now()) {
  return new Date((timestamp ?? Math.floor(fallback / 1000)) * 1000).toISOString();
}

function toLocalStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "expired";
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnds = subscription.items.data.map((item) => item.current_period_end);
  return periodEnds.length ? Math.max(...periodEnds) : null;
}

export async function syncStripeSubscription(options: {
  supabase: SupabaseClient;
  subscription: Stripe.Subscription;
  fallbackUserId?: string;
  fallbackPlan?: PlanId;
  paymentMethodCollected?: boolean;
}) {
  const { supabase, subscription } = options;
  let userId = subscription.metadata.user_id || options.fallbackUserId;
  let planValue: unknown = subscription.metadata.plan || options.fallbackPlan;
  let previousPaymentMethod = false;

  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("user_id, plan, provider_subscription_id, payment_method_collected")
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle();

  if (!userId) userId = existing?.user_id;
  if (!planValue) planValue = existing?.plan;

  if (!userId || !isPlanId(planValue)) {
    throw new Error("A assinatura do Stripe nao possui usuario e plano validos.");
  }

  const { data: userSubscription } = existing
    ? { data: existing }
    : await supabase
      .from("user_subscriptions")
      .select("user_id, plan, provider_subscription_id, payment_method_collected")
      .eq("user_id", userId)
      .maybeSingle();

  if (
    userSubscription?.provider_subscription_id
    && userSubscription.provider_subscription_id !== subscription.id
    && options.paymentMethodCollected !== true
  ) {
    return;
  }
  previousPaymentMethod = Boolean(userSubscription?.payment_method_collected);

  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
  const paymentMethodCollected = options.paymentMethodCollected
    ?? (Boolean(subscription.default_payment_method || subscription.default_source) || previousPaymentMethod);
  const trialStartedAt = toIso(subscription.trial_start, subscription.created * 1000);
  const trialEndsAt = toIso(subscription.trial_end, subscription.created * 1000);
  const periodEnd = subscriptionPeriodEnd(subscription);

  const { error } = await supabase.from("user_subscriptions").upsert({
    user_id: userId,
    plan: planValue,
    status: toLocalStatus(subscription.status),
    trial_started_at: trialStartedAt,
    trial_ends_at: trialEndsAt,
    current_period_ends_at: periodEnd ? toIso(periodEnd) : null,
    provider: "stripe",
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    payment_method_collected: paymentMethodCollected,
  }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);
}

export async function syncCheckoutSession(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
) {
  if (session.status !== "complete") {
    throw new Error("O cadastro de pagamento ainda nao foi concluido.");
  }

  const stripe = getStripe();
  const subscription = typeof session.subscription === "string"
    ? await stripe.subscriptions.retrieve(session.subscription)
    : session.subscription;

  if (!subscription) {
    throw new Error("A assinatura criada no Stripe nao foi localizada.");
  }

  const plan = isPlanId(session.metadata?.plan) ? session.metadata.plan : undefined;
  await syncStripeSubscription({
    supabase,
    subscription,
    fallbackUserId: session.client_reference_id ?? session.metadata?.user_id,
    fallbackPlan: plan,
    paymentMethodCollected: true,
  });
}
