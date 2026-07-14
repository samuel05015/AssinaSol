import { NextResponse } from "next/server";
import { isPlatformAdmin, type AdminOverview, type AdminPlatformCustomer } from "@/lib/admin";
import { isPlanId, planCatalog, type SubscriptionStatus } from "@/lib/billing/plans";
import { getAuthenticatedRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SubscriptionRow = {
  user_id: string;
  plan?: unknown;
  status?: unknown;
  trial_ends_at?: string | null;
  current_period_ends_at?: string | null;
  payment_method_collected?: boolean;
  provider_customer_id?: string | null;
};

const validStatuses = new Set<SubscriptionStatus>(["trialing", "active", "past_due", "canceled", "expired"]);

function subscriptionStatus(value: unknown): SubscriptionStatus | "none" {
  return typeof value === "string" && validStatuses.has(value as SubscriptionStatus)
    ? value as SubscriptionStatus
    : "none";
}

function effectiveSubscriptionStatus(subscription?: SubscriptionRow): SubscriptionStatus | "none" {
  const status = subscriptionStatus(subscription?.status);
  if (status === "trialing" && subscription?.trial_ends_at && Date.parse(subscription.trial_ends_at) <= Date.now()) {
    return "expired";
  }
  return status;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
  if (!isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: "Acesso exclusivo do administrador." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nao configurado." }, { status: 503 });

  try {
    const [usersResult, subscriptionsResult, clientsResult, invoicesResult] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("user_subscriptions").select("*"),
      supabase.from("clients").select("user_id"),
      supabase.from("invoices").select("user_id, final_total"),
    ]);

    if (usersResult.error) throw usersResult.error;
    if (subscriptionsResult.error) throw subscriptionsResult.error;
    if (clientsResult.error) throw clientsResult.error;
    if (invoicesResult.error) throw invoicesResult.error;

    const subscriptions = new Map<string, SubscriptionRow>();
    for (const row of subscriptionsResult.data ?? []) {
      subscriptions.set(row.user_id, row as SubscriptionRow);
    }

    const clientCounts = new Map<string, number>();
    for (const row of clientsResult.data ?? []) {
      clientCounts.set(row.user_id, (clientCounts.get(row.user_id) ?? 0) + 1);
    }

    const invoiceTotals = new Map<string, { count: number; total: number }>();
    for (const row of invoicesResult.data ?? []) {
      const current = invoiceTotals.get(row.user_id) ?? { count: 0, total: 0 };
      invoiceTotals.set(row.user_id, {
        count: current.count + 1,
        total: current.total + Number(row.final_total ?? 0),
      });
    }

    const customers: AdminPlatformCustomer[] = usersResult.data.users.map((authUser) => {
      const subscription = subscriptions.get(authUser.id);
      const complimentaryAccess = authUser.id === process.env.COMPLIMENTARY_USER_ID;
      const plan = complimentaryAccess ? "premium" : isPlanId(subscription?.plan) ? subscription.plan : null;
      const invoices = invoiceTotals.get(authUser.id) ?? { count: 0, total: 0 };
      return {
        id: authUser.id,
        email: authUser.email ?? "Sem e-mail",
        createdAt: authUser.created_at,
        lastSignInAt: authUser.last_sign_in_at ?? null,
        emailConfirmedAt: authUser.email_confirmed_at ?? null,
        plan,
        subscriptionStatus: complimentaryAccess ? "active" : effectiveSubscriptionStatus(subscription),
        trialEndsAt: subscription?.trial_ends_at ?? null,
        currentPeriodEndsAt: subscription?.current_period_ends_at ?? null,
        paymentMethodCollected: complimentaryAccess || Boolean(subscription?.payment_method_collected),
        providerCustomerId: subscription?.provider_customer_id ?? null,
        complimentaryAccess,
        clientsCount: clientCounts.get(authUser.id) ?? 0,
        invoicesCount: invoices.count,
        generatedTotal: invoices.total,
      };
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const activeSubscriptions = customers.filter((customer) => customer.subscriptionStatus === "active").length;
    const trials = customers.filter((customer) => customer.subscriptionStatus === "trialing").length;
    const attentionNeeded = customers.filter((customer) => ["past_due", "expired"].includes(customer.subscriptionStatus)).length;
    const projectedMrr = customers.reduce((total, customer) => {
      if (customer.complimentaryAccess || !customer.plan || !["active", "trialing"].includes(customer.subscriptionStatus)) return total;
      return total + planCatalog[customer.plan].price;
    }, 0);

    const overview: AdminOverview = {
      stats: {
        users: customers.length,
        activeSubscriptions,
        trials,
        attentionNeeded,
        projectedMrr,
      },
      customers,
    };
    return NextResponse.json(overview);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel carregar o painel administrativo.",
    }, { status: 500 });
  }
}
