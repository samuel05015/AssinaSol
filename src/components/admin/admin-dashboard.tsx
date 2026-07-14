"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Search, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminOverview } from "@/lib/admin";
import { planCatalog } from "@/lib/billing/plans";
import { formatCurrency } from "@/lib/solar/format";
import { cn } from "@/lib/utils";

const emptyOverview: AdminOverview = {
  stats: { users: 0, activeSubscriptions: 0, trials: 0, attentionNeeded: 0, projectedMrr: 0 },
  customers: [],
};

const statusLabels = {
  none: "Sem plano",
  trialing: "Em teste",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  expired: "Expirada",
} as const;

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function statusClass(status: keyof typeof statusLabels) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "trialing") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "past_due" || status === "expired") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function AdminDashboard() {
  const { getAuthHeaders } = useAuth();
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadOverview = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/overview", { headers: getAuthHeaders() });
      const data = await response.json() as AdminOverview & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nao foi possivel carregar os clientes.");
      setOverview(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o painel administrativo.");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOverview(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOverview]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return overview.customers.filter((customer) => {
      const matchesSearch = !normalizedSearch || customer.email.toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === "all"
        || customer.subscriptionStatus === statusFilter
        || (statusFilter === "attention" && ["past_due", "expired"].includes(customer.subscriptionStatus));
      return matchesSearch && matchesStatus;
    });
  }, [overview.customers, search, statusFilter]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="flex flex-col gap-5 rounded-lg bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">Administrador</Badge>
          <h1 className="text-3xl font-semibold">Gestao de clientes da plataforma</h1>
          <p className="mt-2 text-sm text-slate-300">Assinaturas, testes, uso do sistema e receita mensal projetada.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadOverview()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Atualizar
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-lg shadow-sm">
          <CardHeader><UsersRound className="size-5 text-orange-600" /><CardTitle>{overview.stats.users}</CardTitle><CardDescription>Usuarios cadastrados</CardDescription></CardHeader>
        </Card>
        <Card className="rounded-lg shadow-sm">
          <CardHeader><CheckCircle2 className="size-5 text-emerald-600" /><CardTitle>{overview.stats.activeSubscriptions}</CardTitle><CardDescription>Assinaturas ativas</CardDescription></CardHeader>
        </Card>
        <Card className="rounded-lg shadow-sm">
          <CardHeader><ShieldCheck className="size-5 text-blue-600" /><CardTitle>{overview.stats.trials}</CardTitle><CardDescription>Testes gratuitos</CardDescription></CardHeader>
        </Card>
        <Card className="rounded-lg shadow-sm">
          <CardHeader><AlertTriangle className="size-5 text-red-600" /><CardTitle>{overview.stats.attentionNeeded}</CardTitle><CardDescription>Precisam de atencao</CardDescription></CardHeader>
        </Card>
        <Card className="rounded-lg shadow-sm sm:col-span-2 xl:col-span-1">
          <CardHeader><WalletCards className="size-5 text-orange-600" /><CardTitle>{formatCurrency(overview.stats.projectedMrr)}</CardTitle><CardDescription>MRR projetado</CardDescription></CardHeader>
        </Card>
      </section>

      <Card className="rounded-lg shadow-sm">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Clientes da plataforma</CardTitle>
            <CardDescription>{filteredCustomers.length} registro(s) encontrados.</CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_210px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-9 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por e-mail" />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
              <SelectTrigger className="h-9 w-full bg-white"><span className="flex-1 text-left">{statusFilter === "all" ? "Todos os status" : statusFilter === "attention" ? "Precisam de atencao" : statusLabels[statusFilter as keyof typeof statusLabels]}</span></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="trialing">Em teste</SelectItem>
                <SelectItem value="attention">Precisam de atencao</SelectItem>
                <SelectItem value="none">Sem plano</SelectItem>
                <SelectItem value="canceled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />Carregando clientes...</div>
          ) : filteredCustomers.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Usuario</TableHead><TableHead>Plano</TableHead><TableHead>Assinatura</TableHead><TableHead>Periodo</TableHead><TableHead>Uso</TableHead><TableHead className="text-right">Total gerado</TableHead><TableHead className="text-right">Acao</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="font-medium text-slate-950">{customer.email}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Cadastro: {formatDate(customer.createdAt)} · Ultimo acesso: {formatDate(customer.lastSignInAt)}</div>
                      <Badge variant="outline" className={cn("mt-2", customer.emailConfirmedAt ? "border-emerald-200 text-emerald-700" : "border-orange-200 text-orange-700")}>
                        {customer.emailConfirmedAt ? "E-mail confirmado" : "Confirmacao pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {customer.complimentaryAccess ? <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">Completo · Cortesia</Badge>
                        : customer.plan ? <Badge variant="outline">{planCatalog[customer.plan].name}</Badge>
                          : <span className="text-muted-foreground">Sem plano</span>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className={statusClass(customer.subscriptionStatus)}>{statusLabels[customer.subscriptionStatus]}</Badge></TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">Teste: {formatDate(customer.trialEndsAt)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Renovacao: {formatDate(customer.currentPeriodEndsAt)}</div>
                    </TableCell>
                    <TableCell><div>{customer.clientsCount} cliente(s)</div><div className="mt-1 text-xs text-muted-foreground">{customer.invoicesCount} fatura(s)</div></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(customer.generatedTotal)}</TableCell>
                    <TableCell className="text-right">
                      {customer.providerCustomerId ? (
                        <Link href={`https://dashboard.stripe.com/customers/${customer.providerCustomerId}`} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                          <ExternalLink className="size-4" />Stripe
                        </Link>
                      ) : <span className="text-xs text-muted-foreground">Sem Stripe</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum cliente encontrado com os filtros atuais.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
