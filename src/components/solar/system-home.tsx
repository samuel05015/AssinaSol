"use client";

import Link from "next/link";
import { FileUp, ReceiptText, Settings2, UserPlus, UsersRound, WalletCards } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { appBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

const actions = [
  {
    title: "Clientes",
    description: "Consulte clientes cadastrados, busque por UC e use o cadastro para iniciar uma nova fatura.",
    href: "/clientes",
    icon: UsersRound,
    primary: true,
  },
  {
    title: "Adicionar cliente",
    description: "Cadastre UC, nome, documento e contatos antes de montar a fatura solar.",
    href: "/clientes/novo",
    icon: UserPlus,
  },
  {
    title: "Carregar fatura",
    description: "Envie a conta de energia em PDF e siga para revisao, calculo e geracao do documento.",
    href: "/carregar-fatura",
    icon: FileUp,
  },
  {
    title: "Configuracoes",
    description: "Personalize logo, empresa, cor e layout das propostas geradas em PDF.",
    href: "/configuracoes",
    icon: Settings2,
  },
];

export function SystemHome() {
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
                Comece cadastrando um cliente ou carregue uma conta de energia para extrair dados automaticamente e gerar a fatura solar.
              </p>
            </div>
            <Link href="/clientes" className={cn(buttonVariants(), "bg-orange-600 text-white hover:bg-orange-700")}>
              <UsersRound className="size-4" />
              Ver clientes
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => {
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

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <ReceiptText className="size-5 text-orange-600" />
              <CardTitle>Clientes</CardTitle>
              <CardDescription>UC como chave para evitar duplicidade.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <FileUp className="size-5 text-orange-600" />
              <CardTitle>PDF de energia</CardTitle>
              <CardDescription>Extracao automatica com revisao manual.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <WalletCards className="size-5 text-orange-600" />
              <CardTitle>Fatura solar</CardTitle>
              <CardDescription>Calculo detalhado, PIX, economia e demonstrativo.</CardDescription>
            </CardHeader>
          </Card>
        </section>
      </div>
    </ProtectedShell>
  );
}
