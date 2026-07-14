"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CreditCard, FileUp, Home, Loader2, LogOut, ReceiptText, Settings2, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { appBrand } from "@/lib/brand";
import { planCatalog } from "@/lib/billing/plans";
import { pendingPlanStorageKey, useBilling } from "@/hooks/use-billing";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/clientes", label: "Clientes", icon: UsersRound },
  { href: "/faturas", label: "Faturas", icon: ReceiptText },
  { href: "/clientes/novo", label: "Adicionar cliente", icon: UserPlus },
  { href: "/carregar-fatura", label: "Carregar fatura", icon: FileUp },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings2 },
  { href: "/planos", label: "Planos", icon: CreditCard },
];

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { configured, getAuthHeaders, loading, user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState(appBrand.name);
  const { billing, loadBilling, startTrial } = useBilling({ autoLoad: Boolean(user || !configured) });

  useEffect(() => {
    if (configured && !loading && !user) {
      router.replace("/entrar");
    }
  }, [configured, loading, router, user]);

  useEffect(() => {
    if (configured && !user) return;

    const pendingPlan = window.localStorage.getItem(pendingPlanStorageKey);
    if (!pendingPlan || !(pendingPlan in planCatalog)) return;

    startTrial(pendingPlan as keyof typeof planCatalog)
      .then(() => {
        window.localStorage.removeItem(pendingPlanStorageKey);
        toast.success("Plano selecionado e teste gratis ativado.");
        void loadBilling();
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Nao foi possivel ativar o plano escolhido.");
      });
  }, [configured, loadBilling, startTrial, user]);

  useEffect(() => {
    if (!configured || !user) {
      return;
    }

    let active = true;

    async function loadCompanyName() {
      try {
        const response = await fetch("/api/settings", {
          headers: getAuthHeaders(),
        });
        const data = (await response.json()) as {
          settings?: {
            companyName?: string | null;
          };
        };

        if (active && response.ok && data.settings?.companyName) {
          setCompanyName(data.settings.companyName);
        }
      } catch {
        // Keep the product brand as a graceful fallback in preview/offline states.
      }
    }

    loadCompanyName();

    return () => {
      active = false;
    };
  }, [configured, getAuthHeaders, user]);

  useEffect(() => {
    function handleSettingsUpdate(event: Event) {
      const detail = (event as CustomEvent<{ companyName?: string | null }>).detail;

      if (detail?.companyName) {
        setCompanyName(detail.companyName);
      }
    }

    window.addEventListener("assinasol-settings-updated", handleSettingsUpdate);

    return () => {
      window.removeEventListener("assinasol-settings-updated", handleSettingsUpdate);
    };
  }, []);

  if (loading || (configured && !user)) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="size-5 animate-spin" />
          Verificando sessao...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f8_100%)]">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={appBrand.logoPath} alt={appBrand.name} className="h-14 w-auto max-w-48 object-contain" />
            <div>
              <p className="text-sm font-semibold text-slate-950">{companyName}</p>
              <p className="text-xs text-muted-foreground">{user?.email ?? "Modo preview sem Supabase"}</p>
            </div>
            {!configured ? <Badge variant="outline">Preview local</Badge> : null}
            {billing.subscription ? (
              <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                Plano {planCatalog[billing.subscription.plan].name}
              </Badge>
            ) : (
              <Link href="/planos">
                <Badge variant="outline">Escolher plano</Badge>
              </Link>
            )}
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: active ? "default" : "ghost" }),
                    active && "bg-slate-950 text-white hover:bg-slate-900"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await signOut();
                router.replace("/entrar");
              }}
            >
              <LogOut className="size-4" />
              Sair
            </Button>
          </nav>
        </div>
      </header>

      {!configured ? (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTitle>Supabase Auth ainda nao configurado</AlertTitle>
            <AlertDescription>
              Preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` para ativar login real. Por enquanto, as telas ficam liberadas em modo preview.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {configured && user && (!billing.subscription || billing.status === "expired") ? (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTitle>{billing.status === "expired" ? "Seu teste gratis terminou" : "Escolha um plano para iniciar o teste gratis"}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {billing.status === "expired"
                  ? "Escolha um plano ativo para continuar usando os recursos do sistema."
                  : "O sistema libera os recursos conforme o plano escolhido. O teste gratis dura 3 dias."}
              </span>
              <Link href="/planos" className={cn(buttonVariants(), "w-fit bg-orange-600 text-white hover:bg-orange-700")}>
                Ver planos
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {children}
    </main>
  );
}
