import { NextResponse } from "next/server";
import { calculateInvoice } from "@/lib/solar/calculate";
import { invoiceCalculationSchema } from "@/lib/solar/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = invoiceCalculationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(calculateInvoice(parsed.data));
}

