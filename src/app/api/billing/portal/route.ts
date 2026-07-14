import { NextResponse } from "next/server";
import { getBillingState } from "@/lib/billing/server";
import { getStripe } from "@/lib/billing/stripe";
import { getAuthenticatedRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "Faca login para gerenciar sua assinatura." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nao configurado." }, { status: 503 });

  try {
    const billing = await getBillingState(supabase, user.id);
    const customerId = billing.subscription?.providerCustomerId;
    if (!customerId) {
      return NextResponse.json({ error: "Nenhuma assinatura Stripe foi localizada." }, { status: 404 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/planos`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel abrir o gerenciamento da assinatura.",
    }, { status: 500 });
  }
}
