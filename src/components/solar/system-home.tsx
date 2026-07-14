"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileUp, Loader2, ReceiptText, Settings2, UsersRound, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { appBrand } from "@/lib/brand";
import { useBilling } from "@/hooks/use-billing";
import type { PlanAccess } from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/solar/format";
import type { DashboardStats, InvoiceStatus } from "@/lib/solar/types";
import { cn } from "@/lib/utils";

const actions = [
  {
    title: "Clientes",
    description: "Consulte clientes cadastrados, busque por UC e use o cadastro para iniciar uma nova fatura.",
    href: "/clientes",
    icon: UsersRound,
    primary: true,
    access: "canSaveClients" as keyof PlanAccess,
  },
  {
    title: "Faturas",
    description: "Acompanhe PDFs gerados, status de cobranca, envio e recorrencia mensal.",
    href: "/faturas",
    icon: ReceiptText,
    access: "canUseInvoiceHistory" as keyof PlanAccess,
  },
  {
    title: "Carregar fatura",
    description: "Anexe PDF opcionalmente ou preencha manualmente para gerar a proposta.",
    href: "/carregar-fatura",
    icon: FileUp,
    access: "canGenerate" as keyof PlanAccess,
  },
  {
    title: "Configuracoes",
    description: "Personalize logo, empresa, cor e layout das propostas geradas em PDF.",
    href: "/configuracoes",
    icon: Settings2,
    access: "canCustomizeProposal" as keyof PlanAccess,
  },
];

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  sent: "Enviada",
  paid: "Paga",
  overdue: "Vencida",
  canceled: "Cancelada",
};

const emptyStats: DashboardStats = {
  clientsCount: 0,
  invoicesCount: 0,
  monthRevenue: 0,
  pendingTotal: 0,
  overdueTotal: 0,
  paidTotal: 0,
  estimatedSavingsTotal: 0,
  recentInvoices: [],
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

export function SystemHome() {
  const { getAuthHeaders } = useAuth();
  const { billing, loading: billingLoading } = useBilling();
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (billingLoading) return;
    if (!billing.access.canUseDashboard) return;

    let active = true;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { headers: getAuthHeaders() });
        const data = await response.json() as { stats?: DashboardStats; warning?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Nao foi possivel carregar o dashboard.");
        if (!active) return;
        setStats(data.stats ?? emptyStats);
        if (data.warning) toast.warning(data.warning);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [billing.access.canUseDashboard, billingLoading, getAuthHeaders]);

  const availableActions = actions.filter((action) => billing.access[action.access]);
  const dashboardLoading = billing.access.canUseDashboard && loading;

  return (
    <ProtectedShell>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-lg bg-slate-950 p-6 text-white shadow-sm">
          <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">Painel inicial</Badge>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Bem-vindo ao {appBrand.name}</h1>
              <p className="mt-2 text-sm font-medium text-orange-100">{appBrand.tagline}</p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Gere propostas solares e acesse somente as ferramentas incluidas no seu plano atual.
              </p>
            </div>
            <Link href="/carregar-fatura" className={cn(buttonVariants(), "bg-orange-600 text-white hover:bg-orange-700")}>
              <FileUp className="size-4" />
              Gerar fatura
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {availableActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.href} className="rounded-lg border-0 shadow-sm ring-slate-200">
                <CardHeader>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle>{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={action.href} className={cn(buttonVariants({ variant: action.primary ? "default" : "outline" }), action.primary && "bg-slate-950 text-white hover:bg-slate-900")}>
                    Abrir
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {billing.access.canUseDashboard ? <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <UsersRound className="size-5 text-orange-600" />
              <CardTitle>{dashboardLoading ? <Loader2 className="size-5 animate-spin" /> : stats.clientsCount}</CardTitle>
              <CardDescription>Clientes ativos</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <WalletCards className="size-5 text-orange-600" />
              <CardTitle>{dashboardLoading ? <Loader2 className="size-5 animate-spin" /> : formatCurrency(stats.monthRevenue)}</CardTitle>
              <CardDescription>Total emitido no mes</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <ReceiptText className="size-5 text-blue-600" />
              <CardTitle>{dashboardLoading ? <Loader2 className="size-5 animate-spin" /> : formatCurrency(stats.pendingTotal)}</CardTitle>
              <CardDescription>Valor em aberto</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <ReceiptText className="size-5 text-red-600" />
              <CardTitle>{dashboardLoading ? <Loader2 className="size-5 animate-spin" /> : formatCurrency(stats.overdueTotal)}</CardTitle>
              <CardDescription>Vencidas nao pagas</CardDescription>
            </CardHeader>
          </Card>
        </section> : null}

        {billing.access.canUseDashboard ? <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <CardTitle>Ultimas faturas</CardTitle>
              <CardDescription>Historico recente com status e vencimento.</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="flex items-center justify-center gap-3 rounded-lg border bg-slate-50 p-8 text-sm text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  Carregando faturas...
                </div>
              ) : stats.recentInvoices.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fatura</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div className="font-medium">{invoice.invoiceNumber}</div>
                          <div className="text-xs text-muted-foreground">{invoice.referenceMonth}</div>
                        </TableCell>
                        <TableCell>{invoice.clientName}</TableCell>
                        <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                        <TableCell><Badge variant="outline">{statusLabels[invoice.status]}</Badge></TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(invoice.finalTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-lg border border-dashed bg-slate-50 p-8 text-center">
                  <ReceiptText className="mx-auto size-8 text-muted-foreground" />
                  <h2 className="mt-4 font-medium text-slate-950">Nenhuma fatura ainda</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Gere uma proposta para alimentar o historico financeiro.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
              <CardDescription>Indicadores acumulados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">Faturas geradas</p>
                <p className="text-xl font-semibold text-slate-950">{stats.invoicesCount}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-green-900">
                <p className="text-xs">Economia estimada total</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.estimatedSavingsTotal)}</p>
              </div>
              <div className="rounded-lg bg-slate-950 p-3 text-white">
                <p className="text-xs text-slate-300">Total recebido</p>
                <p className="text-xl font-semibold">{formatCurrency(stats.paidTotal)}</p>
              </div>
              <Link href="/faturas" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                <ReceiptText className="size-4" />
                Ver todas as faturas
              </Link>
            </CardContent>
          </Card>
        </section> : null}
      </div>
    </ProtectedShell>
  );
}
