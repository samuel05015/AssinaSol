"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, LogIn, ShieldCheck, Sparkles, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth/auth-provider";
import { appBrand } from "@/lib/brand";

export function AuthForm() {
  const router = useRouter();
  const { configured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      if (mode === "sign-in") {
        await signIn(email, password);
        toast.success("Login realizado.");
        router.replace("/inicio");
      } else {
        await signUp(email, password);
        toast.success("Cadastro criado. Confirme seu e-mail se o Supabase exigir confirmacao.");
        router.replace("/inicio");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main data-auth-layout="assinasol-product-login" className="min-h-screen bg-slate-100 p-3 text-slate-950 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200 sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="order-2 flex flex-col justify-between bg-slate-950 p-5 text-white sm:p-8 lg:order-1 lg:p-10">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-16 w-48 items-center justify-center rounded-lg bg-white p-2 shadow-sm ring-1 ring-white/15 sm:h-20 sm:w-64 sm:p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={appBrand.logoPath} alt={appBrand.name} className="max-h-full max-w-full object-contain" />
              </div>
              <Badge className="hidden bg-orange-500 text-white hover:bg-orange-500 sm:inline-flex">Sistema oficial</Badge>
            </div>

            <div className="mt-10 max-w-2xl">
              <p className="flex items-center gap-2 text-sm font-medium text-orange-200">
                <Sparkles className="size-4" />
                {appBrand.tagline}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Acesse sua central de propostas solares.
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                Organize clientes, carregue contas de energia e gere propostas em PDF com calculo financeiro pronto para apresentar.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3 text-sm text-slate-200 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <FileText className="mb-3 size-5 text-orange-300" />
              <p className="font-medium text-white">PDF profissional</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Resumo, demonstrativo e comparativo em A4.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <Zap className="mb-3 size-5 text-orange-300" />
              <p className="font-medium text-white">Calculo em tempo real</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Energia, taxas, bandeira, descontos e total.</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="mb-3 size-5 text-orange-300" />
              <p className="font-medium text-white">Base por cliente</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">UC, dados cadastrais e historico de faturas.</p>
            </div>
          </div>
        </section>

        <section className="order-1 flex items-center justify-center bg-slate-50 px-4 py-8 sm:px-8 lg:order-2 lg:px-10">
          <Card className="w-full max-w-md rounded-lg border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-5">
              <div className="inline-flex w-full rounded-lg bg-slate-100 p-1">
                <Button
                  type="button"
                  variant={mode === "sign-in" ? "default" : "ghost"}
                  className={mode === "sign-in" ? "h-10 flex-1 bg-slate-950 text-white hover:bg-slate-900" : "h-10 flex-1 text-slate-600"}
                  onClick={() => setMode("sign-in")}
                >
                  <LogIn className="size-4" />
                  Entrar
                </Button>
                <Button
                  type="button"
                  variant={mode === "sign-up" ? "default" : "ghost"}
                  className={mode === "sign-up" ? "h-10 flex-1 bg-slate-950 text-white hover:bg-slate-900" : "h-10 flex-1 text-slate-600"}
                  onClick={() => setMode("sign-up")}
                >
                  <UserPlus className="size-4" />
                  Criar conta
                </Button>
              </div>
              <div>
                <CardTitle className="text-2xl">{mode === "sign-in" ? "Entrar no sistema" : "Criar acesso"}</CardTitle>
                <CardDescription className="mt-2">
                  {mode === "sign-in"
                    ? "Continue para o painel de clientes e faturas."
                    : "Crie seu acesso para usar o AssinaSol com Supabase Auth."}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!configured ? (
                <Alert className="mb-5 border-orange-200 bg-orange-50 text-orange-950">
                  <AlertTitle>Configure o Supabase para ativar login real</AlertTitle>
                  <AlertDescription>
                    A navegacao interna esta liberada em modo preview enquanto as variaveis publicas do Supabase nao forem preenchidas.
                  </AlertDescription>
                </Alert>
              ) : null}

              <form className="space-y-5" onSubmit={submit}>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input className="h-11" value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="voce@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input className="h-11" value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Minimo 6 caracteres" required minLength={6} />
                </div>
                <Button type="submit" className="h-11 w-full bg-orange-600 text-white hover:bg-orange-700" disabled={loading || !configured}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : mode === "sign-in" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
                  {mode === "sign-in" ? "Entrar" : "Criar conta"}
                </Button>
              </form>

              {!configured ? (
                <Button type="button" variant="outline" className="mt-4 h-11 w-full" onClick={() => router.push("/inicio")}>
                  Continuar em modo preview
                </Button>
              ) : null}

              <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
                Ambiente protegido pela autenticacao do Supabase.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
