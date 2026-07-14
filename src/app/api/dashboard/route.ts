import { NextResponse } from "next/server";
import { billingRequiredMessage, getBillingState } from "@/lib/billing/server";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";
import type { DashboardStats, InvoiceListItem, InvoiceStatus } from "@/lib/solar/types";

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
  estimated_savings: number | string;
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

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const billing = await getBillingState(supabase, userId);

  if (!billing.access.canUseDashboard) {
    const empty: DashboardStats = {
      clientsCount: 0,
      invoicesCount: 0,
      monthRevenue: 0,
      pendingTotal: 0,
      overdueTotal: 0,
      paidTotal: 0,
      estimatedSavingsTotal: 0,
      recentInvoices: [],
    };
    return NextResponse.json({ stats: empty, warning: billingRequiredMessage("history") });
  }

  if (!supabase) {
    const empty: DashboardStats = {
      clientsCount: 0,
      invoicesCount: 0,
      monthRevenue: 0,
      pendingTotal: 0,
      overdueTotal: 0,
      paidTotal: 0,
      estimatedSavingsTotal: 0,
      recentInvoices: [],
    };
    return NextResponse.json({ stats: empty, warning: "Supabase nao configurado. Dashboard em modo preview." });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const today = now.toISOString().slice(0, 10);

  const [{ count: clientsCount }, { count: invoicesCount }, { data: invoices, error }] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("invoices")
      .select("id, client_id, invoice_number, reference_month, due_date, status, final_total, energy_total, estimated_savings, solar_consumption_kwh, price_per_kwh, discount_percent, pix_key, receiver_name, pdf_url, created_at, updated_at, clients(name, email, phone, uc_code)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (invoices ?? []) as unknown as InvoiceRow[];
  const monthRevenue = rows
    .filter((invoice) => invoice.created_at >= monthStart)
    .reduce((total, invoice) => total + toNumber(invoice.final_total), 0);
  const pendingTotal = rows
    .filter((invoice) => ["pending", "sent", "overdue"].includes(invoice.status))
    .reduce((total, invoice) => total + toNumber(invoice.final_total), 0);
  const overdueTotal = rows
    .filter((invoice) => invoice.status !== "paid" && invoice.status !== "canceled" && invoice.due_date < today)
    .reduce((total, invoice) => total + toNumber(invoice.final_total), 0);
  const paidTotal = rows
    .filter((invoice) => invoice.status === "paid")
    .reduce((total, invoice) => total + toNumber(invoice.final_total), 0);
  const estimatedSavingsTotal = rows.reduce((total, invoice) => total + toNumber(invoice.estimated_savings), 0);

  const stats: DashboardStats = {
    clientsCount: clientsCount ?? 0,
    invoicesCount: invoicesCount ?? 0,
    monthRevenue,
    pendingTotal,
    overdueTotal,
    paidTotal,
    estimatedSavingsTotal,
    recentInvoices: rows.slice(0, 5).map(toInvoice),
  };

  return NextResponse.json({ stats });
}
