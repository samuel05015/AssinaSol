import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { appBrand } from "@/lib/brand";
import { calculateInvoice } from "@/lib/solar/calculate";
import { invoiceCalculationSchema } from "@/lib/solar/schemas";
import { buildInvoicePdf } from "@/lib/solar/pdf-generator";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";
import type { PdfBrandSettings } from "@/lib/solar/types";
import { buildPixCopyPaste } from "@/lib/solar/pix";

export const runtime = "nodejs";

function toDataUrl(bytes: Uint8Array) {
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:application/pdf;base64,${base64}`;
}

async function getLogoBytes(url?: string | null) {
  if (!url) return {};

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return {};
    const contentType = response.headers.get("content-type") ?? "";
    if (!["image/png", "image/jpeg"].some((type) => contentType.includes(type))) return {};
    return {
      logoBytes: new Uint8Array(await response.arrayBuffer()),
      logoContentType: contentType,
    };
  } catch {
    return {};
  }
}

async function getDefaultLogoBytes() {
  try {
    return {
      logoBytes: new Uint8Array(await readFile(path.join(process.cwd(), "public", "brand", "assinasol-logo.png"))),
      logoContentType: "image/png",
    };
  } catch {
    return {};
  }
}

async function getBrandSettings(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<PdfBrandSettings | undefined> {
  if (!supabase) {
    return {
      companyName: appBrand.name,
      companyEmail: "",
      companyPhone: "",
      companyDocument: "",
      companyLogoUrl: appBrand.logoPath,
      proposalColor: "#f97316",
      proposalLayout: "modern",
      ...await getDefaultLogoBytes(),
    };
  }

  const { data, error } = await supabase
    .from("user_invoice_settings")
    .select("company_name, company_email, company_phone, company_document, company_logo_url, proposal_color, proposal_layout")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      companyName: appBrand.name,
      companyEmail: "",
      companyPhone: "",
      companyDocument: "",
      companyLogoUrl: appBrand.logoPath,
      proposalColor: "#f97316",
      proposalLayout: "modern",
      ...await getDefaultLogoBytes(),
    };
  }

  const uploadedLogo = await getLogoBytes(data.company_logo_url);
  return {
    companyName: data.company_name ?? appBrand.name,
    companyEmail: data.company_email ?? "",
    companyPhone: data.company_phone ?? "",
    companyDocument: data.company_document ?? "",
    companyLogoUrl: data.company_logo_url ?? "",
    proposalColor: data.proposal_color ?? "#f97316",
    proposalLayout: data.proposal_layout ?? "modern",
    ...(Object.keys(uploadedLogo).length ? uploadedLogo : await getDefaultLogoBytes()),
  };
}

async function nextInvoiceNumber(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string, fallback?: string) {
  if (fallback?.trim()) return fallback.trim();
  if (!supabase) return `ASS-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  const year = new Date().getFullYear();
  const from = `${year}-01-01T00:00:00.000Z`;
  const to = `${year + 1}-01-01T00:00:00.000Z`;
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", from)
    .lt("created_at", to);

  return `ASS-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function saveInvoiceRecord(params: {
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  userId: string;
  input: ReturnType<typeof invoiceCalculationSchema.parse>;
  calculation: ReturnType<typeof calculateInvoice>;
  pdfUrl: string;
}) {
  const { supabase, userId, input, calculation, pdfUrl } = params;
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      client_id: input.client.id || null,
      invoice_number: calculation.invoiceNumber,
      reference_month: input.referenceMonth,
      due_date: input.dueDate,
      total_consumption_kwh: input.totalConsumptionKwh ?? 0,
      solar_consumption_kwh: input.solarConsumptionKwh,
      accumulated_credit_kwh: input.accumulatedCreditKwh ?? 0,
      price_per_kwh: input.pricePerKwh,
      discount_percent: input.discountPercent,
      discount_value: calculation.discountValue,
      energy_subtotal: calculation.energySubtotal,
      energy_total: calculation.energyTotal,
      fio_b_value: input.fioBValue,
      charge_fio_b: input.chargeFioB,
      public_lighting_value: input.publicLightingValue,
      charge_public_lighting: input.chargePublicLighting,
      utility_bill_value: input.utilityBillValue,
      charge_utility_bill: input.chargeUtilityBill,
      tariff_flag: input.tariffFlag,
      tariff_flag_value: calculation.selectedTariffValue,
      estimated_utility_cost: calculation.estimatedUtilityCost,
      estimated_savings: calculation.estimatedSavings,
      total_extra_fees: calculation.totalExtraFees,
      total_extra_discounts: calculation.totalExtraDiscounts,
      total_late_fees: calculation.totalLateFees,
      final_total: calculation.finalTotal,
      pix_key: input.pixKey || null,
      receiver_name: input.receiverName || null,
      notes: input.notes || null,
      pdf_url: pdfUrl,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (input.adjustments.length) {
    const { error: adjustmentsError } = await supabase
      .from("invoice_adjustments")
      .insert(input.adjustments.map((item) => ({
        invoice_id: invoice.id,
        type: item.type,
        name: item.name,
        amount: item.amount,
      })));
    if (adjustmentsError) throw new Error(adjustmentsError.message);
  }

  const lateFeeIds = input.lateFees
    .filter((fee) => fee.id && fee.status === "pending")
    .map((fee) => fee.id as string);

  if (lateFeeIds.length) {
    await supabase
      .from("late_fees")
      .update({ status: "included" })
      .eq("user_id", userId)
      .in("id", lateFeeIds);
  }

  if (input.client.id) {
    await supabase
      .from("client_billing_profiles")
      .upsert({
        user_id: userId,
        client_id: input.client.id,
        recurrence_enabled: true,
        default_due_day: Number(input.dueDate.slice(-2)) || null,
        default_price_per_kwh: input.pricePerKwh,
        default_discount_percent: input.discountPercent,
        default_pix_key: input.pixKey || null,
        default_receiver_name: input.receiverName || null,
        last_invoice_id: invoice.id,
        next_reference_month: "",
      }, { onConflict: "user_id,client_id" });
  }

  return invoice.id as string;
}

export async function POST(request: Request) {
  const parsed = invoiceCalculationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const invoiceNumber = await nextInvoiceNumber(supabase, userId, input.invoiceNumber);
  const inputWithNumber = { ...input, invoiceNumber };
  const calculation = calculateInvoice(inputWithNumber);
  const brandSettings = await getBrandSettings(supabase, userId);
  const pixCopyPaste = buildPixCopyPaste({
    pixKey: inputWithNumber.pixKey,
    receiverName: inputWithNumber.receiverName,
    amount: calculation.finalTotal,
    invoiceNumber: calculation.invoiceNumber,
  });
  const pdfBytes = await buildInvoicePdf(inputWithNumber, calculation, brandSettings);

  if (!supabase) {
    return NextResponse.json({
      url: toDataUrl(pdfBytes),
      calculation,
      pixCopyPaste,
      warning: "Supabase nao configurado. PDF retornado como data URL.",
    });
  }

  const filePath = `${userId}/${calculation.invoiceNumber}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("solar-invoices")
    .upload(filePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("solar-invoices").getPublicUrl(filePath);
  const invoiceId = await saveInvoiceRecord({
    supabase,
    userId,
    input: inputWithNumber,
    calculation,
    pdfUrl: data.publicUrl,
  });

  return NextResponse.json({ url: data.publicUrl, calculation, invoiceId, pixCopyPaste });
}
