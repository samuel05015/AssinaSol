"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { Building2, ImagePlus, Loader2, Palette, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { ProtectedShell } from "@/components/auth/protected-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { appBrand } from "@/lib/brand";
import { companySettingsSchema, type CompanySettingsSchema } from "@/lib/solar/schemas";
import { maskBrazilianPhone, maskCpfCnpj } from "@/lib/solar/format";
import { cn } from "@/lib/utils";

const settingsResolver = zodResolver(companySettingsSchema) as Resolver<CompanySettingsSchema>;

const colorOptions = [
  { label: "Solar", value: "#f97316" },
  { label: "Azul", value: "#0f172a" },
  { label: "Verde", value: "#15803d" },
  { label: "Ciano", value: "#0369a1" },
  { label: "Vinho", value: "#be123c" },
];

const defaultValues: CompanySettingsSchema = {
  companyName: appBrand.name,
  companyEmail: "",
  companyPhone: "",
  companyDocument: "",
  companyLogoUrl: "",
  proposalColor: "#f97316",
  proposalLayout: "modern",
};

type SettingsResponse = {
  settings?: CompanySettingsSchema;
  warning?: string;
  error?: string | Record<string, unknown>;
};

function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function getErrorMessage(error: SettingsResponse["error"]) {
  if (!error) return "Nao foi possivel salvar as configuracoes.";
  if (typeof error === "string") return error;
  return "Revise os campos destacados.";
}

export function SettingsForm() {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanySettingsSchema>({
    resolver: settingsResolver,
    defaultValues,
    mode: "onBlur",
  });

  const watched = useWatch({ control }) as CompanySettingsSchema;
  const visibleLogo = logoPreview || watched.companyLogoUrl || "";
  const layoutLabel = useMemo(() => {
    if (watched.proposalLayout === "classic") return "Classico";
    if (watched.proposalLayout === "compact") return "Compacto";
    return "Moderno";
  }, [watched.proposalLayout]);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const response = await fetch("/api/settings", { headers: getAuthHeaders() });
        const data = await response.json() as SettingsResponse;
        if (!response.ok) throw new Error(getErrorMessage(data.error));

        if (!active || !data.settings) return;
        setValue("companyName", data.settings.companyName);
        setValue("companyEmail", data.settings.companyEmail ?? "");
        setValue("companyPhone", data.settings.companyPhone ?? "");
        setValue("companyDocument", data.settings.companyDocument ?? "");
        setValue("companyLogoUrl", data.settings.companyLogoUrl ?? "");
        setValue("proposalColor", data.settings.proposalColor ?? defaultValues.proposalColor);
        setValue("proposalLayout", data.settings.proposalLayout ?? defaultValues.proposalLayout);
        if (data.warning) toast.warning(data.warning);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar as configuracoes.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, [getAuthHeaders, setValue]);

  function onLogoChange(file?: File) {
    setLogoFile(file ?? null);
    if (!file) {
      setLogoPreview("");
      return;
    }
    setLogoPreview(URL.createObjectURL(file));
  }

  async function submit(values: CompanySettingsSchema) {
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("companyName", values.companyName);
      payload.append("companyEmail", values.companyEmail ?? "");
      payload.append("companyPhone", values.companyPhone ?? "");
      payload.append("companyDocument", values.companyDocument);
      payload.append("companyLogoUrl", values.companyLogoUrl ?? "");
      payload.append("proposalColor", values.proposalColor);
      payload.append("proposalLayout", values.proposalLayout);
      if (logoFile) payload.append("logo", logoFile);

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: getAuthHeaders(),
        body: payload,
      });
      const data = await response.json() as SettingsResponse;
      if (!response.ok) throw new Error(getErrorMessage(data.error));

      if (data.settings) {
        window.dispatchEvent(
          new CustomEvent("assinasol-settings-updated", {
            detail: data.settings,
          }),
        );
        setValue("companyLogoUrl", data.settings.companyLogoUrl ?? "");
        setLogoFile(null);
        setLogoPreview("");
      }
      toast.success(data.warning ?? "Configuracoes salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProtectedShell>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-lg bg-slate-950 p-6 text-white shadow-sm">
          <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">Configuracoes</Badge>
          <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Identidade da proposta</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Configure a marca, dados comerciais e aparencia do PDF enviado aos clientes.
              </p>
            </div>
            <div className="rounded-lg bg-white/10 p-4">
              <p className="text-xs text-slate-300">Layout selecionado</p>
              <p className="mt-1 text-xl font-semibold">{layoutLabel}</p>
            </div>
          </div>
        </section>

        <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]" onSubmit={handleSubmit(submit)}>
          <div className="space-y-6">
            <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <CardTitle>Dados da empresa</CardTitle>
                    <CardDescription>Esses dados aparecem no cabecalho e rodape da proposta.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Nome da empresa" error={errors.companyName?.message}>
                  <Input {...register("companyName")} placeholder={`Ex.: ${appBrand.name} Energia`} />
                </Field>
                <Field label="CNPJ" error={errors.companyDocument?.message}>
                  <Input
                    value={watched.companyDocument ?? ""}
                    onChange={(event) => setValue("companyDocument", maskCpfCnpj(event.target.value), { shouldValidate: true })}
                    placeholder="00.000.000/0000-00"
                  />
                </Field>
                <Field label="Gmail da empresa" helper="Opcional" error={errors.companyEmail?.message}>
                  <Input {...register("companyEmail")} type="email" placeholder="empresa@gmail.com" />
                </Field>
                <Field label="Telefone" helper="Opcional" error={errors.companyPhone?.message}>
                  <Input
                    value={watched.companyPhone ?? ""}
                    onChange={(event) => setValue("companyPhone", maskBrazilianPhone(event.target.value))}
                    placeholder="(11) 99999-9999"
                  />
                </Field>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                    <ImagePlus className="size-5" />
                  </div>
                  <div>
                    <CardTitle>Logo</CardTitle>
                    <CardDescription>Use PNG ou JPG com fundo transparente ou claro.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="grid aspect-square place-items-center rounded-lg border bg-slate-50 p-4">
                  {visibleLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={visibleLogo} alt="Logo da empresa" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="grid size-16 place-items-center rounded-lg text-xl font-semibold text-white" style={{ backgroundColor: watched.proposalColor }}>
                      {(watched.companyName || "AS").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <Input type="file" accept="image/png,image/jpeg" onChange={(event) => onLogoChange(event.target.files?.[0])} />
                  <Input type="hidden" {...register("companyLogoUrl")} />
                  <p className="text-xs leading-5 text-muted-foreground">
                    A imagem e salva no Storage e usada automaticamente nos PDFs gerados depois da configuracao.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                    <Palette className="size-5" />
                  </div>
                  <div>
                    <CardTitle>Aparencia da proposta</CardTitle>
                    <CardDescription>Escolha a cor principal e o layout do PDF.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Cor principal" error={errors.proposalColor?.message}>
                  <div className="flex flex-wrap items-center gap-2">
                    {colorOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "size-9 rounded-lg border-2 bg-white p-1",
                          watched.proposalColor === option.value ? "border-slate-950" : "border-transparent"
                        )}
                        onClick={() => setValue("proposalColor", option.value, { shouldValidate: true })}
                        title={option.label}
                      >
                        <span className="block size-full rounded-md" style={{ backgroundColor: option.value }} />
                      </button>
                    ))}
                    <Input
                      type="color"
                      value={watched.proposalColor}
                      onChange={(event) => setValue("proposalColor", event.target.value, { shouldValidate: true })}
                      className="h-9 w-16 p-1"
                    />
                  </div>
                </Field>
                <Field label="Layout da proposta" error={errors.proposalLayout?.message}>
                  <Select value={watched.proposalLayout} onValueChange={(value) => setValue("proposalLayout", value as CompanySettingsSchema["proposalLayout"], { shouldValidate: true })}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Selecione o layout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Moderno</SelectItem>
                      <SelectItem value="classic">Classico</SelectItem>
                      <SelectItem value="compact">Compacto</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card className="overflow-hidden rounded-lg border-0 shadow-sm ring-slate-200">
              <div className={cn("p-5 text-white", watched.proposalLayout === "classic" && "bg-white text-slate-950")} style={{ backgroundColor: watched.proposalLayout === "classic" ? "#ffffff" : watched.proposalColor }}>
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-lg bg-white/90 p-2 text-sm font-semibold" style={{ color: watched.proposalColor }}>
                    {visibleLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={visibleLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                    ) : (
                      (watched.companyName || "AS").slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{watched.companyName || "Nome da empresa"}</p>
                    <p className="text-xs opacity-80">{watched.companyDocument || "CNPJ"}</p>
                  </div>
                </div>
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="size-5 text-orange-600" />
                  Preview
                </CardTitle>
                <CardDescription>Esse visual sera usado nas proximas propostas geradas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">Contato</p>
                  <p className="font-medium text-slate-950">{watched.companyEmail || watched.companyPhone || "Nao informado"}</p>
                </div>
                <div className="rounded-lg p-4 text-white" style={{ backgroundColor: watched.proposalColor }}>
                  <p className="text-xs opacity-80">Valor final</p>
                  <p className="mt-1 text-2xl font-semibold">R$ 156,01</p>
                </div>
                <Button type="submit" className="w-full bg-orange-600 text-white hover:bg-orange-700" disabled={saving || loading}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Salvar configuracoes
                </Button>
              </CardContent>
            </Card>
          </aside>
        </form>
      </div>
    </ProtectedShell>
  );
}
