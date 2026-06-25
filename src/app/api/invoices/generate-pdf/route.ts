import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { appBrand } from "@/lib/brand";
import { calculateInvoice } from "@/lib/solar/calculate";
import { invoiceCalculationSchema } from "@/lib/solar/schemas";
import { buildInvoicePdf } from "@/lib/solar/pdf-generator";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";
import type { PdfBrandSettings } from "@/lib/solar/types";

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

export async function POST(request: Request) {
  const parsed = invoiceCalculationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const calculation = calculateInvoice(input);
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const brandSettings = await getBrandSettings(supabase, userId);
  const pdfBytes = await buildInvoicePdf(input, calculation, brandSettings);

  if (!supabase) {
    return NextResponse.json({
      url: toDataUrl(pdfBytes),
      calculation,
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
  return NextResponse.json({ url: data.publicUrl, calculation });
}
