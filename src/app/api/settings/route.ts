import { NextResponse } from "next/server";
import { appBrand } from "@/lib/brand";
import { billingRequiredMessage, getBillingState } from "@/lib/billing/server";
import { companySettingsSchema } from "@/lib/solar/schemas";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const defaultSettings = {
  companyName: appBrand.name,
  companyEmail: "",
  companyPhone: "",
  companyDocument: "",
  companyLogoUrl: "",
  proposalColor: "#f97316",
  proposalLayout: "modern" as const,
};

type SettingsRow = {
  company_name?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_document?: string | null;
  company_logo_url?: string | null;
  proposal_color?: string | null;
  proposal_layout?: "modern" | "classic" | "compact" | null;
};

function toSettings(row?: SettingsRow | null) {
  return {
    companyName: row?.company_name ?? defaultSettings.companyName,
    companyEmail: row?.company_email ?? "",
    companyPhone: row?.company_phone ?? "",
    companyDocument: row?.company_document ?? "",
    companyLogoUrl: row?.company_logo_url ?? "",
    proposalColor: row?.proposal_color ?? defaultSettings.proposalColor,
    proposalLayout: row?.proposal_layout ?? defaultSettings.proposalLayout,
  };
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const billing = await getBillingState(supabase, userId);

  if (!billing.access.canCustomizeProposal) {
    return NextResponse.json({
      settings: defaultSettings,
      warning: billingRequiredMessage("settings"),
    });
  }

  if (!supabase) {
    return NextResponse.json({
      settings: defaultSettings,
      warning: "Supabase nao configurado. Configuracoes serao exibidas apenas como pre-visualizacao.",
    });
  }

  const { data, error } = await supabase
    .from("user_invoice_settings")
    .select("company_name, company_email, company_phone, company_document, company_logo_url, proposal_color, proposal_layout")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: toSettings(data as SettingsRow | null) });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const billing = await getBillingState(supabase, userId);

  if (!billing.access.canCustomizeProposal) {
    return NextResponse.json({ error: billingRequiredMessage("settings") }, { status: 402 });
  }

  const formData = await request.formData();
  const currentLogoUrl = readFormString(formData, "companyLogoUrl");

  let companyLogoUrl = currentLogoUrl;
  const logo = formData.get("logo");

  if (supabase && logo instanceof File && logo.size > 0) {
    if (!["image/png", "image/jpeg"].includes(logo.type)) {
      return NextResponse.json({ error: "Envie uma logo em PNG ou JPG." }, { status: 400 });
    }

    if (logo.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "A logo deve ter no maximo 2 MB." }, { status: 400 });
    }

    const extension = logo.type.includes("png") ? "png" : "jpg";
    const path = `${userId}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(path, await logo.arrayBuffer(), {
        contentType: logo.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
    companyLogoUrl = data.publicUrl;
  }

  const parsed = companySettingsSchema.safeParse({
    companyName: readFormString(formData, "companyName"),
    companyEmail: readFormString(formData, "companyEmail"),
    companyPhone: readFormString(formData, "companyPhone"),
    companyDocument: readFormString(formData, "companyDocument"),
    companyLogoUrl,
    proposalColor: readFormString(formData, "proposalColor") || defaultSettings.proposalColor,
    proposalLayout: readFormString(formData, "proposalLayout") || defaultSettings.proposalLayout,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({
      settings: parsed.data,
      warning: "Supabase nao configurado. Configuracoes nao foram persistidas.",
    });
  }

  const { data, error } = await supabase
    .from("user_invoice_settings")
    .upsert({
      user_id: userId,
      company_name: parsed.data.companyName,
      company_email: parsed.data.companyEmail || null,
      company_phone: parsed.data.companyPhone || null,
      company_document: parsed.data.companyDocument,
      company_logo_url: parsed.data.companyLogoUrl || null,
      proposal_color: parsed.data.proposalColor,
      proposal_layout: parsed.data.proposalLayout,
    }, { onConflict: "user_id" })
    .select("company_name, company_email, company_phone, company_document, company_logo_url, proposal_color, proposal_layout")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: toSettings(data as SettingsRow) });
}
