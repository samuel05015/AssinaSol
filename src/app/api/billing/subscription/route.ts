import { NextResponse } from "next/server";
import { getBillingState, startTrialForPlan } from "@/lib/billing/server";
import { isPlanId, planCatalog, trialDays } from "@/lib/billing/plans";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const billing = await getBillingState(supabase, userId);

  return NextResponse.json({
    ...billing,
    plans: Object.values(planCatalog),
    trialDays,
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const plan = body.plan;

  if (!isPlanId(plan)) {
    return NextResponse.json({ error: "Escolha um plano valido." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);

  try {
    const billing = await startTrialForPlan(supabase, userId, plan);
    return NextResponse.json({
      ...billing,
      plans: Object.values(planCatalog),
      trialDays,
      message: `Teste gratis de ${trialDays} dias iniciado no plano ${planCatalog[plan].name}.`,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel iniciar o teste.",
    }, { status: 500 });
  }
}
