"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appBrand } from "@/lib/brand";

export function PaymentConfirmation({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const { getAuthHeaders, loading: authLoading, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const validationError = !authLoading && !user
    ? "Sua sessao expirou. Entre novamente para confirmar o pagamento."
    : !authLoading && !sessionId
      ? "Sessao do Stripe ausente."
      : null;
  const displayError = error ?? validationError;

  useEffect(() => {
    if (authLoading) return;
    if (!user || !sessionId) return;

    let active = true;
    async function confirmSubscription() {
      try {
        const response = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ sessionId }),
        });
        const data = await response.json() as { error?: string; message?: string };
        if (!response.ok) throw new Error(data.error ?? "Nao foi possivel confirmar a assinatura.");
        if (!active) return;
        toast.success(data.message ?? "Teste gratis ativado.");
        router.replace("/inicio");
        router.refresh();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Nao foi possivel confirmar a assinatura.");
      }
    }

    void confirmSubscription();
    return () => { active = false; };
  }, [authLoading, getAuthHeaders, router, sessionId, user]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <Card className="w-full max-w-lg rounded-lg bg-white text-center shadow-sm">
        <CardHeader>
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            {displayError ? <CheckCircle2 className="size-7" /> : <Loader2 className="size-7 animate-spin" />}
          </div>
          <CardTitle>{displayError ? "Precisamos concluir sua ativacao" : "Confirmando seu teste gratis"}</CardTitle>
          <CardDescription>
            {displayError ?? `Estamos sincronizando seu pagamento seguro com o ${appBrand.name}.`}
          </CardDescription>
        </CardHeader>
        {displayError ? (
          <CardContent>
            <Button type="button" className="bg-orange-600 text-white hover:bg-orange-700" onClick={() => router.push("/planos")}>
              Voltar aos planos
            </Button>
          </CardContent>
        ) : null}
      </Card>
    </main>
  );
}
