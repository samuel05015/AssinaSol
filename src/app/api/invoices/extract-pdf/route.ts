import { NextResponse } from "next/server";
import { extractInvoiceFromPdf } from "@/lib/solar/pdf-extraction";
import { billingRequiredMessage, getBillingState } from "@/lib/billing/server";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const billing = await getBillingState(supabase, await getRequestUserId(request));
    if (!billing.access.canGenerate) {
      return NextResponse.json({ error: billingRequiredMessage("plan") }, { status: 402 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const password = formData.get("password")?.toString();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo PDF obrigatorio" }, { status: 400 });
    }

    const data = await extractInvoiceFromPdf(file, password || undefined);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao extrair dados do PDF";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
