"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
    <main className="grid min-h-screen bg-slate-950 px-4 py-8 text-white lg:grid-cols-[1fr_460px]">
      <section className="flex min-h-[420px] flex-col justify-between rounded-lg bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_62%,#ea580c_100%)] p-6 lg:p-10">
        <div>
          <div className="flex h-20 w-56 items-center justify-center rounded-lg bg-white/95 p-3 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={appBrand.logoPath} alt={appBrand.name} className="max-h-full max-w-full object-contain" />
          </div>
          <h1 className="mt-8 max-w-2xl text-4xl font-semibold tracking-tight lg:text-5xl">{appBrand.name}</h1>
          <p className="mt-2 text-sm font-medium text-orange-100">{appBrand.tagline}</p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-100">
            Painel para cadastrar clientes, carregar contas de energia, calcular propostas solares e gerar PDFs financeiros profissionais.
          </p>
        </div>
        <div className="mt-10 grid gap-3 text-sm text-slate-100 sm:grid-cols-3">
          <div className="rounded-lg bg-white/10 p-3">Clientes por UC sem duplicidade</div>
          <div className="rounded-lg bg-white/10 p-3">Extracao automatica de PDF</div>
          <div className="rounded-lg bg-white/10 p-3">Fatura solar com demonstrativo</div>
        </div>
      </section>

      <section className="flex items-center justify-center py-8 lg:py-0">
        <Card className="w-full max-w-md rounded-lg bg-white text-slate-950">
          <CardHeader>
            <CardTitle>{mode === "sign-in" ? "Entrar no sistema" : "Criar acesso"}</CardTitle>
            <CardDescription>
              Use o e-mail e senha cadastrados no Supabase Auth.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!configured ? (
              <Alert className="mb-4 border-orange-200 bg-orange-50">
                <AlertTitle>Configure o Supabase para ativar login real</AlertTitle>
                <AlertDescription>
                  A navegacao interna esta liberada em modo preview enquanto as variaveis publicas do Supabase nao forem preenchidas.
                </AlertDescription>
              </Alert>
            ) : null}

            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="voce@email.com" required />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Minimo 6 caracteres" required minLength={6} />
              </div>
              <Button type="submit" className="w-full bg-orange-600 text-white hover:bg-orange-700" disabled={loading || !configured}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : mode === "sign-in" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
                {mode === "sign-in" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <Separator className="my-5" />

            <Button type="button" variant="outline" className="w-full" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
              {mode === "sign-in" ? "Criar novo acesso" : "Ja tenho acesso"}
            </Button>

            {!configured ? (
              <Button type="button" variant="ghost" className="mt-3 w-full" onClick={() => router.push("/inicio")}>
                Continuar em modo preview
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
