import { NextResponse } from "next/server";
import { calculateLateFee } from "@/lib/solar/calculate";
import { lateFeeInputSchema } from "@/lib/solar/schemas";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json({ records: [] });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ records: [] });
  }

  const { data, error } = await supabase
    .from("late_fees")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ records: data });
}

export async function POST(request: Request) {
  const parsed = lateFeeInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const calculated = calculateLateFee(input);
  const record = {
    originalInvoiceReference: input.originalInvoiceReference,
    originalDueDate: input.originalDueDate,
    paymentDate: input.paymentDate,
    originalAmount: input.originalAmount,
    finePercent: input.finePercent,
    interestPercent: input.interestPercent,
    interestType: input.interestType,
    ...calculated,
    status: "pending" as const,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase || !input.clientId) {
    return NextResponse.json({ record: { id: crypto.randomUUID(), ...record } });
  }

  const { data, error } = await supabase
    .from("late_fees")
    .insert({
      user_id: await getRequestUserId(request),
      client_id: input.clientId,
      original_invoice_reference: input.originalInvoiceReference,
      original_due_date: input.originalDueDate,
      payment_date: input.paymentDate,
      original_amount: input.originalAmount,
      fine_percent: input.finePercent,
      interest_percent: input.interestPercent,
      interest_type: input.interestType,
      days_late: calculated.daysLate,
      fine_amount: calculated.fineAmount,
      interest_amount: calculated.interestAmount,
      total_amount: calculated.totalAmount,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ record: data });
}
