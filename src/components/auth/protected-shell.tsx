"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileUp, Home, Loader2, LogOut, Settings2, UserPlus, UsersRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { appBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/inicio", label: "Inicio", icon: Home },
  { href: "/clientes", label: "Clientes", icon: UsersRound },
  { href: "/clientes/novo", label: "Adicionar cliente", icon: UserPlus },
  { href: "/carregar-fatura", label: "Carregar fatura", icon: FileUp },
  { href: "/configuracoes", label: "Configuracoes", icon: Settings2 },
];

export function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { configured, getAuthHeaders, loading, user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [companyName, setCompanyName] = useState(appBrand.name);

  useEffect(() => {
    if (configured && !loading && !user) {
      router.replace("/entrar");
    }
  }, [configured, loading, router, user]);

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
            <div className="flex h-10 w-28 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={appBrand.logoPath} alt={appBrand.name} className="max-h-full max-w-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">{companyName}</p>
              <p className="text-xs text-muted-foreground">{user?.email ?? "Modo preview sem Supabase"}</p>
            </div>
            {!configured ? <Badge variant="outline">Preview local</Badge> : null}
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

      {children}
    </main>
  );
}
