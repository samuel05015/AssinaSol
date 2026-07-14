"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, LockKeyhole, Palette, ReceiptText, Sparkles, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth/auth-provider";
import { pendingPlanStorageKey, useBilling } from "@/hooks/use-billing";
import { appBrand } from "@/lib/brand";
import { planCatalog, trialDays, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const commercialFeatures = [
  { title: "Gerar proposta", icon: ReceiptText },
  { title: "Salvar clientes", icon: UsersRound },
  { title: "Personalizar marca", icon: Palette },
  { title: "Historico completo", icon: LockKeyhole },
];

export function PricingPage() {
  const router = useRouter();
  const { configured, user } = useAuth();
  const { billing, startCheckout, openBillingPortal, updating } = useBilling({ autoLoad: Boolean(user || !configured) });

  async function choosePlan(plan: PlanId) {
    if (configured && !user) {
      localStorage.setItem(pendingPlanStorageKey, plan);
      toast.info("Crie sua conta para ativar o teste gratis.");
      router.push("/entrar");
      return;
    }

    try {
      const hasManagedSubscription = billing.subscription?.provider === "stripe"
        && ["trialing", "active", "past_due"].includes(billing.status);
      const url = hasManagedSubscription
        ? await openBillingPortal()
        : await startCheckout(plan);
      localStorage.removeItem(pendingPlanStorageKey);
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel abrir o pagamento.");
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f8_100%)] text-slate-950">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={appBrand.logoPath} alt={appBrand.name} className="h-14 w-auto max-w-56 object-contain" />
          </div>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link href="/inicio" className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}>
                Abrir sistema
              </Link>
            ) : null}
            <Link href="/entrar" className={cn(buttonVariants(), "bg-slate-950 text-white hover:bg-slate-900")}>
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="flex flex-col justify-center">
          <Badge className="mb-4 w-fit bg-orange-500 text-white hover:bg-orange-500">
            Teste gratis de {trialDays} dias
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Venda energia por assinatura com propostas solares prontas em minutos.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            O {appBrand.name} transforma dados da conta de energia em uma Fatura Solar profissional, com demonstrativo,
            economia estimada, PIX e controle por plano para sua operacao crescer sem bagunca.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button className="h-12 bg-orange-600 px-6 text-white hover:bg-orange-700" onClick={() => choosePlan("pro")}>
              <Sparkles className="size-4" />
              Comecar teste no Profissional
            </Button>
            <Link href="#planos" className={cn(buttonVariants({ variant: "outline" }), "h-12 px-6")}>
              Ver planos
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {commercialFeatures.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-lg border bg-white p-4 shadow-sm">
                  <Icon className="mb-3 size-5 text-orange-600" />
                  <p className="text-sm font-semibold">{item.title}</p>
                </div>
              );
            })}
          </div>
        </div>

      </section>

      <section id="planos" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Planos do {appBrand.name}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cadastre o pagamento com seguranca no Stripe. Nada e cobrado hoje; o teste de {trialDays} dias
            comeca somente depois da confirmacao do cartao.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {Object.values(planCatalog).map((plan) => {
            const selected = billing.subscription?.plan === plan.id && billing.status !== "none";
            return (
              <Card key={plan.id} className={cn(
                "relative rounded-lg border bg-white shadow-sm",
                plan.popular && "border-orange-300 ring-2 ring-orange-100",
              )}>
                {plan.popular ? (
                  <Badge className="absolute right-4 top-4 bg-orange-500 text-white hover:bg-orange-500">Mais escolhido</Badge>
                ) : null}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.headline}</CardDescription>
                  <div className="pt-3">
                    <span className="text-4xl font-semibold">{formatPrice(plan.price)}</span>
                    <span className="text-sm text-muted-foreground">/mes</span>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{plan.description}</p>
                </CardHeader>
                <CardContent className="flex min-h-[360px] flex-col justify-between gap-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2 text-sm leading-5 text-slate-700">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    className={cn("h-11 w-full", plan.popular ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-slate-950 text-white hover:bg-slate-900")}
                    disabled={updating}
                    onClick={() => choosePlan(plan.id)}
                  >
                    {updating ? <Loader2 className="size-4 animate-spin" /> : null}
                    {selected ? "Gerenciar assinatura" : plan.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </main>
  );
}
