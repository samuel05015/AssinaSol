"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyPlus, Download, FileText, Loader2, Mail, MessageCircle, ReceiptText, Search } from "lucide-react";
import { toast } from "sonner";

import { ProtectedShell } from "@/components/auth/protected-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { pendingInvoiceDraftStorageKey } from "@/components/solar/add-client-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { appBrand } from "@/lib/brand";
import { formatCurrency, formatKwh } from "@/lib/solar/format";
import { buildInvoiceEmailLink, buildInvoiceWhatsappLink } from "@/lib/solar/pix";
import type { InvoiceDraft, InvoiceListItem, InvoiceStatus } from "@/lib/solar/types";
import { cn } from "@/lib/utils";

type InvoicesResponse = {
  invoices: InvoiceListItem[];
  warning?: string;
  error?: string;
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  sent: "Enviada",
  paid: "Paga",
  overdue: "Vencida",
  canceled: "Cancelada",
};

const statusTone: Record<InvoiceStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  sent: "border-blue-200 bg-blue-50 text-blue-800",
  paid: "border-green-200 bg-green-50 text-green-800",
  overdue: "border-red-200 bg-red-50 text-red-800",
  canceled: "border-slate-200 bg-slate-100 text-slate-500",
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function isOverdue(invoice: InvoiceListItem) {
  const today = new Date().toISOString().slice(0, 10);
  return !["paid", "canceled"].includes(invoice.status) && invoice.dueDate < today;
}

function buildDraft(invoice: InvoiceListItem): InvoiceDraft {
  return {
    sourceInvoiceId: invoice.id,
    client: {
      id: invoice.clientId,
      ucCode: invoice.clientUcCode ?? "",
      name: invoice.clientName,
      email: invoice.clientEmail,
      phone: invoice.clientPhone,
    },
    solarConsumptionKwh: invoice.solarConsumptionKwh,
    pricePerKwh: invoice.pricePerKwh,
    discountPercent: invoice.discountPercent,
    pixKey: invoice.pixKey,
    receiverName: invoice.receiverName,
    notes: `Fatura recorrente baseada na ${invoice.invoiceNumber}.`,
  };
}

export function InvoiceList() {
  const router = useRouter();
  const { getAuthHeaders } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        const response = await fetch(`/api/invoices${params.toString() ? `?${params}` : ""}`, {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const data = await response.json() as InvoicesResponse;
        if (!response.ok) throw new Error(data.error ?? "Nao foi possivel carregar as faturas.");
        setInvoices(data.invoices ?? []);
        if (data.warning) toast.warning(data.warning);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar as faturas.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [getAuthHeaders, search]);

  const totals = useMemo(() => {
    return {
      count: invoices.length,
      pending: invoices.filter((invoice) => ["pending", "sent", "overdue"].includes(invoice.status)).reduce((total, invoice) => total + invoice.finalTotal, 0),
      overdue: invoices.filter(isOverdue).reduce((total, invoice) => total + invoice.finalTotal, 0),
    };
  }, [invoices]);

  async function updateStatus(invoice: InvoiceListItem, status: InvoiceStatus) {
    setUpdatingId(invoice.id);
    try {
      const response = await fetch(`/api/invoices?id=${encodeURIComponent(invoice.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; warning?: string };
      if (!response.ok) throw new Error(data.error ?? "Nao foi possivel atualizar o status.");
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status } : item));
      toast.success(data.warning ?? "Status atualizado.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar o status.");
    } finally {
      setUpdatingId("");
    }
  }

  function repeatInvoice(invoice: InvoiceListItem) {
    localStorage.setItem(pendingInvoiceDraftStorageKey, JSON.stringify(buildDraft(invoice)));
    toast.info("Fatura carregada como base. Revise mes, vencimento e consumo antes de gerar.");
    router.push("/carregar-fatura");
  }

  function emailLink(invoice: InvoiceListItem) {
    return buildInvoiceEmailLink({
      email: invoice.clientEmail,
      clientName: invoice.clientName,
      invoiceNumber: invoice.invoiceNumber,
      referenceMonth: invoice.referenceMonth,
      total: formatCurrency(invoice.finalTotal),
      pdfUrl: invoice.pdfUrl,
      companyName: appBrand.name,
    });
  }

  function whatsappLink(invoice: InvoiceListItem) {
    return buildInvoiceWhatsappLink({
      phone: invoice.clientPhone,
      clientName: invoice.clientName,
      invoiceNumber: invoice.invoiceNumber,
      referenceMonth: invoice.referenceMonth,
      total: formatCurrency(invoice.finalTotal),
      dueDate: formatDate(invoice.dueDate),
      pixKey: invoice.pixKey,
      pdfUrl: invoice.pdfUrl,
      companyName: appBrand.name,
    });
  }

  return (
    <ProtectedShell>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-lg bg-slate-950 p-6 text-white shadow-sm">
          <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">Historico financeiro</Badge>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Faturas geradas</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Acompanhe PDF, vencimento, status de cobranca e envie a proposta por e-mail ou WhatsApp.
              </p>
            </div>
            <Link href="/carregar-fatura" className={cn(buttonVariants(), "bg-orange-600 text-white hover:bg-orange-700")}>
              <FileText className="size-4" />
              Nova fatura
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <ReceiptText className="size-5 text-orange-600" />
              <CardTitle>{totals.count}</CardTitle>
              <CardDescription>Faturas na consulta</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <ReceiptText className="size-5 text-orange-600" />
              <CardTitle>{formatCurrency(totals.pending)}</CardTitle>
              <CardDescription>Total em aberto</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <ReceiptText className="size-5 text-red-600" />
              <CardTitle>{formatCurrency(totals.overdue)}</CardTitle>
              <CardDescription>Faturas vencidas</CardDescription>
            </CardHeader>
          </Card>
        </section>

        <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
          <CardHeader>
            <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
              <div>
                <CardTitle>Controle de faturas</CardTitle>
                <CardDescription>Use status para controlar inadimplencia e recorrencia mensal.</CardDescription>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="bg-white pl-9" placeholder="Buscar numero, mes ou status" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div> : null}
            {loading ? (
              <div className="flex items-center justify-center gap-3 rounded-lg border bg-slate-50 p-10 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                Carregando faturas...
              </div>
            ) : invoices.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fatura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Consumo</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const effectiveStatus = isOverdue(invoice) ? "overdue" : invoice.status;
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div className="font-medium text-slate-950">{invoice.invoiceNumber}</div>
                          <div className="text-xs text-muted-foreground">{invoice.referenceMonth}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{invoice.clientName}</div>
                          <div className="font-mono text-xs text-muted-foreground">UC {invoice.clientUcCode || "-"}</div>
                        </TableCell>
                        <TableCell>{formatKwh(invoice.solarConsumptionKwh)}</TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <Badge variant="outline" className={statusTone[effectiveStatus]}>{statusLabels[effectiveStatus]}</Badge>
                            <Select value={invoice.status} onValueChange={(value) => updateStatus(invoice, value as InvoiceStatus)} disabled={updatingId === invoice.id}>
                              <SelectTrigger className="h-8 w-32 bg-white text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(invoice.finalTotal)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            {invoice.pdfUrl ? (
                              <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                                <Download className="size-4" />
                                PDF
                              </a>
                            ) : null}
                            <a href={emailLink(invoice)} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                              <Mail className="size-4" />
                              E-mail
                            </a>
                            <a href={whatsappLink(invoice)} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                              <MessageCircle className="size-4" />
                              WhatsApp
                            </a>
                            <Button type="button" size="sm" variant="outline" onClick={() => repeatInvoice(invoice)}>
                              <CopyPlus className="size-4" />
                              Repetir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-10 text-center">
                <ReceiptText className="mx-auto size-8 text-muted-foreground" />
                <h2 className="mt-4 font-medium text-slate-950">Nenhuma fatura gerada</h2>
                <p className="mt-2 text-sm text-muted-foreground">Gere a primeira fatura para ativar historico, envio e controle de status.</p>
                <Link href="/carregar-fatura" className={cn(buttonVariants(), "mt-5 bg-orange-600 text-white hover:bg-orange-700")}>
                  <FileText className="size-4" />
                  Gerar fatura
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedShell>
  );
}
