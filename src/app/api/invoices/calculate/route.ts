import { NextResponse } from "next/server";
import { calculateInvoice } from "@/lib/solar/calculate";
import { invoiceCalculationSchema } from "@/lib/solar/schemas";
import { billingRequiredMessage, getBillingState } from "@/lib/billing/server";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const billing = await getBillingState(supabase, await getRequestUserId(request));
  if (!billing.access.canGenerate) {
    return NextResponse.json({ error: billingRequiredMessage("plan") }, { status: 402 });
  }

  const parsed = invoiceCalculationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(calculateInvoice(parsed.data));
}
