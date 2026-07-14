import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getPlanAccess,
  getSubscriptionStatus,
  isPlanId,
  noPlanAccess,
  planCatalog,
  trialDays,
  type BillingSubscription,
  type PlanAccess,
} from "@/lib/billing/plans";

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  trial_started_at: string;
  trial_ends_at: string;
  current_period_ends_at: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  payment_method_collected: boolean;
  created_at: string;
  updated_at: string;
};

export type BillingState = {
  subscription: BillingSubscription | null;
  access: PlanAccess;
  status: ReturnType<typeof getSubscriptionStatus>;
};

function toSubscription(row: SubscriptionRow): BillingSubscription | null {
  if (!isPlanId(row.plan)) return null;
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status as BillingSubscription["status"],
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEndsAt: row.current_period_ends_at,
    provider: row.provider,
    providerCustomerId: row.provider_customer_id,
    providerSubscriptionId: row.provider_subscription_id,
    paymentMethodCollected: row.payment_method_collected,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBillingState(
  supabase: SupabaseClient | null,
  userId: string,
): Promise<BillingState> {
  if (!supabase) {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
    const subscription: BillingSubscription = {
      userId,
      plan: "premium",
      status: "trialing",
      trialStartedAt: now.toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
      provider: "preview",
      paymentMethodCollected: true,
    };
    return { subscription, access: planCatalog.premium.access, status: "trialing" };
  }

  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("id, user_id, plan, status, trial_started_at, trial_ends_at, current_period_ends_at, provider, provider_customer_id, provider_subscription_id, payment_method_collected, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return { subscription: null, access: noPlanAccess, status: "none" };
  }

  const subscription = toSubscription(data as SubscriptionRow);
  return {
    subscription,
    access: getPlanAccess(subscription),
    status: getSubscriptionStatus(subscription),
  };
}

export function billingRequiredMessage(feature: "plan" | "clients" | "settings" | "history" | "lateFees" = "plan") {
  if (feature === "clients") return "Seu plano atual nao permite salvar clientes. Escolha o plano Profissional ou Completo.";
  if (feature === "settings") return "Seu plano atual nao permite personalizar propostas. Escolha o plano Profissional ou Completo.";
  if (feature === "history") return "Seu plano atual nao inclui historico, dashboard e faturas salvas. Escolha o plano Completo.";
  if (feature === "lateFees") return "Multa e juros de mora estao disponiveis no plano Completo.";
  return "Escolha um plano e cadastre o pagamento no Stripe para iniciar seu teste gratis de 3 dias.";
}
