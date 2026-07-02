import { NextResponse } from "next/server";
import { invoiceStatusSchema } from "@/lib/solar/schemas";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";
import type { InvoiceListItem, InvoiceStatus } from "@/lib/solar/types";

export const runtime = "nodejs";

type InvoiceRow = {
  id: string;
  client_id: string | null;
  invoice_number: string;
  reference_month: string;
  due_date: string;
  status: InvoiceStatus;
  final_total: number | string;
  energy_total: number | string;
  solar_consumption_kwh: number | string;
  price_per_kwh: number | string;
  discount_percent: number | string;
  pix_key: string | null;
  receiver_name: string | null;
  pdf_url: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    uc_code: string | null;
  } | Array<{
    name: string | null;
    email: string | null;
    phone: string | null;
    uc_code: string | null;
  }> | null;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInvoice(row: InvoiceRow): InvoiceListItem {
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;

  return {
    id: row.id,
    clientId: row.client_id ?? undefined,
    clientName: client?.name ?? "Cliente sem nome",
    clientEmail: client?.email ?? "",
    clientPhone: client?.phone ?? "",
    clientUcCode: client?.uc_code ?? "",
    invoiceNumber: row.invoice_number,
    referenceMonth: row.reference_month,
    dueDate: row.due_date,
    status: row.status,
    finalTotal: toNumber(row.final_total),
    energyTotal: toNumber(row.energy_total),
    solarConsumptionKwh: toNumber(row.solar_consumption_kwh),
    pricePerKwh: toNumber(row.price_per_kwh),
    discountPercent: toNumber(row.discount_percent),
    pixKey: row.pix_key ?? "",
    receiverName: row.receiver_name ?? "",
    pdfUrl: row.pdf_url ?? "",
    sentAt: row.sent_at ?? "",
    paidAt: row.paid_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeSearch(value: string | null) {
  return (value ?? "").trim().replace(/[,%]/g, " ");
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const url = new URL(request.url);
  const search = sanitizeSearch(url.searchParams.get("search"));
  const clientId = url.searchParams.get("clientId");

  if (!supabase) {
    return NextResponse.json({
      invoices: [],
      warning: "Supabase nao configurado. Historico de faturas fica vazio em preview.",
    });
  }

  let query = supabase
    .from("invoices")
    .select("id, client_id, invoice_number, reference_month, due_date, status, final_total, energy_total, solar_consumption_kwh, price_per_kwh, discount_percent, pix_key, receiver_name, pdf_url, created_at, updated_at, clients(name, email, phone, uc_code)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (clientId) query = query.eq("client_id", clientId);
  if (search) {
    const term = `%${search}%`;
    query = query.or([
      `invoice_number.ilike.${term}`,
      `reference_month.ilike.${term}`,
      `status.ilike.${term}`,
    ].join(","));
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ invoices: (data ?? []).map((row) => toInvoice(row as unknown as InvoiceRow)) });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Informe a fatura." }, { status: 400 });
  }

  const parsed = invoiceStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: true, warning: "Supabase nao configurado. Status alterado apenas em preview." });
  }

  const { error } = await supabase
    .from("invoices")
    .update({
      status: parsed.data.status,
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
