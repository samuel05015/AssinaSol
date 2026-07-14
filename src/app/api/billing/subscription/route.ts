import { NextResponse } from "next/server";
import { getBillingState } from "@/lib/billing/server";
import { planCatalog, trialDays } from "@/lib/billing/plans";
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
