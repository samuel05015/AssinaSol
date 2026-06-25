"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { ArrowRight, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProtectedShell } from "@/components/auth/protected-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { maskBrazilianPhone, maskCpfCnpj } from "@/lib/solar/format";
import { clientSchema, type ClientSchema } from "@/lib/solar/schemas";

export const pendingClientStorageKey = "solar-faturas-pending-client";

const clientResolver = zodResolver(clientSchema) as Resolver<ClientSchema>;

export function AddClientForm() {
  const router = useRouter();
  const { getAuthHeaders } = useAuth();
  const [saving, setSaving] = useState(false);
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientSchema>({
    resolver: clientResolver,
    defaultValues: {
      ucCode: "",
      name: "",
      document: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  const document = useWatch({ control, name: "document" });
  const phone = useWatch({ control, name: "phone" });

  async function submit(values: ClientSchema) {
    setSaving(true);
    try {
      const response = await fetch("/api/clients/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Nao foi possivel salvar o cliente.");
      }

      const nextClient = {
        id: data.client?.id,
        ucCode: values.ucCode,
        name: values.name,
        document: values.document,
        email: values.email,
        phone: values.phone,
        address: values.address,
      };
      localStorage.setItem(pendingClientStorageKey, JSON.stringify(nextClient));
      toast.success(data.warning ?? "Cliente salvo. Continue na fatura.");
      router.push("/carregar-fatura");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-lg bg-slate-950 p-6 text-white shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Adicionar cliente</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Cadastre os dados principais do cliente. Depois de salvar, voce sera direcionado para a tela de carregar fatura com o cliente preenchido.
          </p>
        </section>

        <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
          <CardHeader>
            <CardTitle>Dados do cliente</CardTitle>
            <CardDescription>Nome e UC sao obrigatorios. Documento, e-mail, telefone e endereco ajudam no preenchimento futuro.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-5 border-blue-200 bg-blue-50">
              <AlertTitle>Evitar duplicidade</AlertTitle>
              <AlertDescription>A Unidade Consumidora e usada como chave unica por usuario no Supabase.</AlertDescription>
            </Alert>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submit)}>
              <div className="space-y-1.5">
                <Label>Unidade Consumidora (UC)</Label>
                <Input {...register("ucCode")} placeholder="Ex.: 123456789" />
                {errors.ucCode ? <p className="text-xs text-destructive">{errors.ucCode.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>Nome do cliente</Label>
                <Input {...register("name")} placeholder="Nome completo" />
                {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input value={document ?? ""} onChange={(event) => setValue("document", maskCpfCnpj(event.target.value), { shouldValidate: true })} placeholder="000.000.000-00" />
                {errors.document ? <p className="text-xs text-destructive">{errors.document.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input {...register("email")} type="email" placeholder="cliente@email.com" />
                {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={phone ?? ""} onChange={(event) => setValue("phone", maskBrazilianPhone(event.target.value))} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Endereco</Label>
                <Textarea {...register("address")} rows={3} placeholder="Rua, numero, bairro, cidade" />
              </div>
              <div className="flex flex-wrap gap-3 md:col-span-2">
                <Button type="submit" className="bg-orange-600 text-white hover:bg-orange-700" disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Salvar cliente
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push("/carregar-fatura")}>
                  <ArrowRight className="size-4" />
                  Ir para carregar fatura
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ProtectedShell>
  );
}
