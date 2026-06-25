"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import {
  AlertCircle,
  Banknote,
  Calculator,
  CalendarDays,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Loader2,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/auth-provider";
import { pendingClientStorageKey } from "@/components/solar/add-client-form";
import { appBrand } from "@/lib/brand";
import { calculateInvoice, calculateLateFee } from "@/lib/solar/calculate";
import { formatCurrency, formatKwh, maskBrazilianPhone, maskCpfCnpj } from "@/lib/solar/format";
import { invoiceCalculationSchema, type InvoiceCalculationSchema } from "@/lib/solar/schemas";
import type { ExtractedInvoiceData, InvoiceAdjustment, LateFeeRecord } from "@/lib/solar/types";
import { cn } from "@/lib/utils";

const preferencesKey = "solar-faturas-preferences";

type LateFeeDraft = {
  originalInvoiceReference: string;
  originalDueDate: string;
  paymentDate: string;
  originalAmount: number;
  finePercent: number;
  interestPercent: number;
  interestType: "monthly" | "daily";
};

function getRememberedPdfPassword() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(preferencesKey);
    if (!raw) return "";
    const preferences = JSON.parse(raw) as { rememberedPdfPassword?: string };
    return preferences.rememberedPdfPassword ?? "";
  } catch {
    return "";
  }
}

const defaultValues: InvoiceCalculationSchema = {
  client: {
    ucCode: "",
    name: "",
    document: "",
    email: "",
    phone: "",
    address: "",
  },
  invoiceNumber: "",
  referenceMonth: "",
  dueDate: "",
  totalConsumptionKwh: 0,
  solarConsumptionKwh: 0,
  accumulatedCreditKwh: 0,
  pricePerKwh: 1,
  discountPercent: 0,
  fioBValue: 0,
  chargeFioB: false,
  publicLightingValue: 0,
  chargePublicLighting: false,
  utilityBillValue: 0,
  chargeUtilityBill: false,
  tariffFlag: "green",
  tariffValues: {
    green: 0,
    yellow: 0,
    red: 0,
  },
  pixKey: "",
  receiverName: "",
  notes: "",
  adjustments: [],
  lateFees: [],
};

type RememberState = {
  pdfPassword: boolean;
  dueDay: boolean;
  pixKey: boolean;
  receiverName: boolean;
  pricePerKwh: boolean;
  discountPercent: boolean;
  fioB: boolean;
  publicLighting: boolean;
  utilityBill: boolean;
};

const initialRemember: RememberState = {
  pdfPassword: false,
  dueDay: false,
  pixKey: false,
  receiverName: false,
  pricePerKwh: false,
  discountPercent: false,
  fioB: false,
  publicLighting: false,
  utilityBill: false,
};

const invoiceResolver = zodResolver(invoiceCalculationSchema) as Resolver<InvoiceCalculationSchema>;

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof Upload;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
            <Icon className="size-5" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  helper,
  error,
  missing,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      <div className={cn(missing && "rounded-lg ring-2 ring-orange-300")}>{children}</div>
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function RememberCheckbox({
  checked,
  onChange,
  label = "Lembrar",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />
      {label}
    </label>
  );
}

function getDueParts(value?: string) {
  if (!value) return { day: "", month: "", year: "" };
  const [year, month, day] = value.split("-");
  return { day: day ?? "", month: month ?? "", year: year ?? "" };
}

function buildDueDate(day: string, month: string, year: string) {
  if (!day || !month || !year) return "";
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : "Nao foi possivel concluir a operacao";
    throw new Error(message);
  }
  return data;
}

export function UploadInvoiceFlow() {
  const { getAuthHeaders } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState(getRememberedPdfPassword);
  const [remember, setRemember] = useState<RememberState>(initialRemember);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [clientNotice, setClientNotice] = useState("");
  const [adjustmentDraft, setAdjustmentDraft] = useState<InvoiceAdjustment>({ type: "fee", name: "", amount: 0 });
  const [lateFeeDraft, setLateFeeDraft] = useState<LateFeeDraft>({
    originalInvoiceReference: "",
    originalDueDate: "",
    paymentDate: "",
    originalAmount: 0,
    finePercent: 2,
    interestPercent: 1,
    interestType: "monthly" as const,
  });

  const form = useForm<InvoiceCalculationSchema>({
    resolver: invoiceResolver,
    defaultValues,
    mode: "onBlur",
  });

  const {
    register,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors },
  } = form;

  const watched = useWatch({ control: form.control }) as InvoiceCalculationSchema;
  const dueParts = getDueParts(watched.dueDate);

  const preview = useMemo(() => {
    return calculateInvoice({
      ...defaultValues,
      ...watched,
      client: { ...defaultValues.client, ...watched.client },
      tariffValues: { ...defaultValues.tariffValues, ...watched.tariffValues },
      adjustments: watched.adjustments ?? [],
      lateFees: watched.lateFees ?? [],
      solarConsumptionKwh: Number(watched.solarConsumptionKwh) || 0,
      pricePerKwh: Number(watched.pricePerKwh) || 0,
      discountPercent: Number(watched.discountPercent) || 0,
      fioBValue: Number(watched.fioBValue) || 0,
      publicLightingValue: Number(watched.publicLightingValue) || 0,
      utilityBillValue: Number(watched.utilityBillValue) || 0,
    });
  }, [watched]);
  const previewFeesWithoutTariff = roundMoney(preview.totalFees - preview.tariffFlagCost + preview.totalExtraFees);

  useEffect(() => {
    const raw = localStorage.getItem(preferencesKey);
    if (!raw) return;

    try {
      const preferences = JSON.parse(raw) as Partial<InvoiceCalculationSchema & { rememberedPdfPassword?: string; defaultDueDay?: string }>;
      if (preferences.defaultDueDay) {
        const current = new Date();
        setValue("dueDate", buildDueDate(preferences.defaultDueDay, String(current.getMonth() + 1), String(current.getFullYear())));
      }
      if (preferences.pixKey) setValue("pixKey", preferences.pixKey);
      if (preferences.receiverName) setValue("receiverName", preferences.receiverName);
      if (preferences.pricePerKwh) setValue("pricePerKwh", preferences.pricePerKwh);
      if (preferences.discountPercent !== undefined) setValue("discountPercent", preferences.discountPercent);
      if (preferences.fioBValue !== undefined) setValue("fioBValue", preferences.fioBValue);
      if (preferences.chargeFioB !== undefined) setValue("chargeFioB", preferences.chargeFioB);
      if (preferences.publicLightingValue !== undefined) setValue("publicLightingValue", preferences.publicLightingValue);
      if (preferences.chargePublicLighting !== undefined) setValue("chargePublicLighting", preferences.chargePublicLighting);
      if (preferences.chargeUtilityBill !== undefined) setValue("chargeUtilityBill", preferences.chargeUtilityBill);
    } catch {
      localStorage.removeItem(preferencesKey);
    }
  }, [setValue]);

  useEffect(() => {
    const raw = localStorage.getItem(pendingClientStorageKey);
    if (!raw) return;

    try {
      const client = JSON.parse(raw) as InvoiceCalculationSchema["client"];
      if (client.id) setValue("client.id", client.id);
      if (client.ucCode) setValue("client.ucCode", client.ucCode, { shouldValidate: true });
      if (client.name) setValue("client.name", client.name, { shouldValidate: true });
      if (client.document) setValue("client.document", client.document, { shouldValidate: true });
      if (client.email) setValue("client.email", client.email);
      if (client.phone) setValue("client.phone", client.phone);
      if (client.address) setValue("client.address", client.address);
      window.setTimeout(() => {
        setClientNotice("Cliente carregado da tela de cadastro. Continue anexando a conta de energia ou preenchendo os dados da fatura.");
      }, 0);
    } catch {
      localStorage.removeItem(pendingClientStorageKey);
      return;
    }

    localStorage.removeItem(pendingClientStorageKey);
  }, [setValue]);

  function saveRememberedSettings() {
    const values = getValues();
    const next: Record<string, unknown> = {};
    if (remember.pdfPassword) next.rememberedPdfPassword = password;
    if (remember.dueDay) next.defaultDueDay = getDueParts(values.dueDate).day;
    if (remember.pixKey) next.pixKey = values.pixKey;
    if (remember.receiverName) next.receiverName = values.receiverName;
    if (remember.pricePerKwh) next.pricePerKwh = values.pricePerKwh;
    if (remember.discountPercent) next.discountPercent = values.discountPercent;
    if (remember.fioB) {
      next.fioBValue = values.fioBValue;
      next.chargeFioB = values.chargeFioB;
    }
    if (remember.publicLighting) {
      next.publicLightingValue = values.publicLightingValue;
      next.chargePublicLighting = values.chargePublicLighting;
    }
    if (remember.utilityBill) next.chargeUtilityBill = values.chargeUtilityBill;
    localStorage.setItem(preferencesKey, JSON.stringify(next));
  }

  function setDuePart(part: "day" | "month" | "year", value: string) {
    const next = { ...dueParts, [part]: value };
    setValue("dueDate", buildDueDate(next.day, next.month, next.year), { shouldDirty: true, shouldValidate: true });
  }

  function applyExtractedData(data: ExtractedInvoiceData) {
    if (data.ucCode) setValue("client.ucCode", data.ucCode, { shouldValidate: true });
    if (data.clientName) setValue("client.name", data.clientName, { shouldValidate: true });
    if ("document" in data) setValue("client.document", data.document ? maskCpfCnpj(data.document) : "", { shouldValidate: true });
    if (data.address) setValue("client.address", data.address);
    if (data.email) setValue("client.email", data.email);
    if (data.phone) setValue("client.phone", maskBrazilianPhone(data.phone));
    if (data.referenceMonth) setValue("referenceMonth", data.referenceMonth, { shouldValidate: true });
    if (data.dueDate) setValue("dueDate", data.dueDate, { shouldValidate: true });
    if (data.totalConsumptionKwh !== undefined) setValue("totalConsumptionKwh", data.totalConsumptionKwh);
    if (data.solarConsumptionKwh !== undefined) setValue("solarConsumptionKwh", data.solarConsumptionKwh, { shouldValidate: true });
    if (data.accumulatedCreditKwh !== undefined) setValue("accumulatedCreditKwh", data.accumulatedCreditKwh);
    if (data.utilityBillValue !== undefined) setValue("utilityBillValue", data.utilityBillValue);
    if (data.publicLightingValue !== undefined) setValue("publicLightingValue", data.publicLightingValue);
    if (data.fioBValue !== undefined) setValue("fioBValue", data.fioBValue);
    if (data.tariffFlag) setValue("tariffFlag", data.tariffFlag);
    setMissingFields(data.missingFields ?? []);
  }

  async function extractPdf() {
    if (!file) {
      toast.error("Selecione um PDF antes de extrair os dados.");
      return;
    }

    setExtracting(true);
    setPdfUrl("");
    try {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("password", password);

      const data = await parseJsonResponse<ExtractedInvoiceData>(await fetch("/api/invoices/extract-pdf", {
        method: "POST",
        body: payload,
      }));

      applyExtractedData(data);
      saveRememberedSettings();

      if (data.missingFields?.length) {
        toast.warning("Verifique os campos destacados. Campos nao encontrados no PDF ficam em branco.");
      } else {
        toast.success("Dados extraidos do PDF.");
      }

      if (data.ucCode) {
        setClientNotice("UC encontrada. Salve para criar ou atualizar o cliente sem duplicidade.");
      } else {
        setClientNotice("Novo cliente detectado ou UC nao localizada. Preencha a UC antes de salvar.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao extrair dados.");
    } finally {
      setExtracting(false);
    }
  }

  async function saveClient() {
    const values = getValues().client;
    setSavingClient(true);
    try {
      const data = await parseJsonResponse<{ client: { id?: string }; warning?: string }>(await fetch("/api/clients/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(values),
      }));
      if (data.client.id) setValue("client.id", data.client.id);
      toast.success(data.warning ?? "Dados do cliente salvos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o cliente.");
    } finally {
      setSavingClient(false);
    }
  }

  function addAdjustment() {
    if (!adjustmentDraft.name || adjustmentDraft.amount <= 0) {
      toast.error("Informe nome e valor do ajuste.");
      return;
    }

    setValue("adjustments", [
      ...(getValues().adjustments ?? []),
      { ...adjustmentDraft, id: crypto.randomUUID() },
    ], { shouldDirty: true });
    setAdjustmentDraft({ type: "fee", name: "", amount: 0 });
  }

  function removeAdjustment(id?: string) {
    setValue("adjustments", (getValues().adjustments ?? []).filter((item) => item.id !== id), { shouldDirty: true });
  }

  async function addLateFee() {
    const calculated = calculateLateFee(lateFeeDraft);
    const record: LateFeeRecord = {
      id: crypto.randomUUID(),
      clientId: getValues().client.id,
      ...lateFeeDraft,
      ...calculated,
      status: "pending",
    };

    setValue("lateFees", [...(getValues().lateFees ?? []), record], { shouldDirty: true });
    toast.success("Multa/juros adicionados aos pendentes desta fatura.");

    try {
      await fetch("/api/late-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ ...lateFeeDraft, clientId: getValues().client.id }),
      });
    } catch {
      toast.warning("Registro mantido localmente. Configure o Supabase para persistir multas/juros.");
    }
  }

  function removeLateFee(id?: string) {
    setValue("lateFees", (getValues().lateFees ?? []).filter((item) => item.id !== id), { shouldDirty: true });
  }

  async function generatePdf(values: InvoiceCalculationSchema) {
    setGeneratingPdf(true);
    setPdfUrl("");
    try {
      saveRememberedSettings();
      const data = await parseJsonResponse<{ url: string; warning?: string }>(await fetch("/api/invoices/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(values),
      }));
      setPdfUrl(data.url);
      toast.success(data.warning ?? "Fatura Solar gerada com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel gerar o PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  function onInvalid(invalidErrors: FieldErrors<InvoiceCalculationSchema>) {
    const firstKey = Object.keys(invalidErrors)[0];
    toast.error(firstKey ? "Revise os campos obrigatorios destacados." : "Revise o formulario.");
  }

  const missing = (field: string) => missingFields.includes(field);
  const fileSize = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "";

  return (
    <div className="bg-[linear-gradient(180deg,#f8fafc_0%,#eef3f8_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg bg-slate-950 px-5 py-5 text-white shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge className="mb-3 bg-orange-500 text-white hover:bg-orange-500">{appBrand.name}</Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Carregar Fatura</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Extraia dados da conta de energia, revise o cliente, configure a cobranca solar e gere uma proposta em PDF com demonstrativo completo.
            </p>
          </div>
          <Link href="/clientes" className={cn(buttonVariants({ variant: "secondary" }))}>
            <Database className="size-4" />
            Banco de dados de Clientes
          </Link>
        </header>

        <form className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" onSubmit={handleSubmit(generatePdf, onInvalid)}>
          <div className="space-y-6">
            <Section title="1. Selecionar PDF" description="Envie a conta de energia e informe senha apenas se o arquivo for protegido." icon={Upload}>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="bg-white"
                  />
                  {file ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
                      <div>
                        <p className="font-medium text-slate-900">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{fileSize}</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setFile(null)}>
                        <Trash2 className="size-4" />
                        Remover
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <Field label="Senha do PDF" helper="Use este campo se o arquivo for protegido por senha">
                    <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha opcional" type="password" />
                  </Field>
                  <RememberCheckbox checked={remember.pdfPassword} onChange={(value) => setRemember({ ...remember, pdfPassword: value })} label="Lembrar senha" />
                  <Button type="button" className="w-full bg-orange-600 text-white hover:bg-orange-700" onClick={extractPdf} disabled={extracting}>
                    {extracting ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                    Extrair Dados
                  </Button>
                </div>
              </div>

              {missingFields.length ? (
                <Alert className="mt-4 border-orange-200 bg-orange-50">
                  <AlertCircle className="size-4 text-orange-700" />
                  <AlertTitle>Verifique os campos destacados</AlertTitle>
                  <AlertDescription>Campos nao encontrados no PDF ficam em branco - preencha manualmente.</AlertDescription>
                </Alert>
              ) : null}
            </Section>

            <Section title="2. Dados da Conta" description="Revise os dados do cliente antes de salvar ou atualizar a UC." icon={ReceiptText}>
              {clientNotice ? (
                <Alert className="mb-4 border-blue-200 bg-blue-50">
                  <CheckCircle2 className="size-4 text-blue-700" />
                  <AlertTitle>Novo cliente detectado</AlertTitle>
                  <AlertDescription>{clientNotice}</AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Unidade Consumidora (UC)" helper="Codigo do cliente da concessionaria" error={errors.client?.ucCode?.message} missing={missing("ucCode")}>
                  <Input {...register("client.ucCode")} placeholder="Ex.: 123456789" />
                </Field>
                <Field label="Nome do Cliente" error={errors.client?.name?.message} missing={missing("clientName")}>
                  <Input {...register("client.name")} placeholder="Nome completo" />
                </Field>
                <Field label="CPF / CNPJ" error={errors.client?.document?.message}>
                  <Input
                    value={watched.client?.document ?? ""}
                    onChange={(event) => setValue("client.document", maskCpfCnpj(event.target.value), { shouldValidate: true })}
                    placeholder="000.000.000-00"
                  />
                </Field>
                <Field label="E-mail do cliente" helper={`Opcional - para envio da fatura. O envio sera feito por ${appBrand.email}`} error={errors.client?.email?.message}>
                  <Input {...register("client.email")} type="email" placeholder="cliente@email.com" />
                </Field>
                <Field label="Telefone do cliente" error={errors.client?.phone?.message}>
                  <Input
                    value={watched.client?.phone ?? ""}
                    onChange={(event) => setValue("client.phone", maskBrazilianPhone(event.target.value))}
                    placeholder="(11) 99999-9999"
                  />
                </Field>
                <Field label="Endereco" helper="O endereco ajuda no preenchimento automatico futuro" error={errors.client?.address?.message}>
                  <Input {...register("client.address")} placeholder="Rua, numero, bairro, cidade" />
                </Field>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button type="button" onClick={saveClient} disabled={savingClient}>
                  {savingClient ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Salvar dados do cliente
                </Button>
                <Link href="/clientes" className={cn(buttonVariants({ variant: "outline" }))}>
                  <Database className="size-4" />
                  Banco de dados de Clientes
                </Link>
              </div>
            </Section>

            <Section title="3. Configuracoes da Fatura Solar" description="Mes de referencia, vencimento, consumo e dados de cobranca." icon={Calculator}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mes de referencia" error={errors.referenceMonth?.message} missing={missing("referenceMonth")}>
                  <Input {...register("referenceMonth")} placeholder="Maio/2026" />
                </Field>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Vencimento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input value={dueParts.day} onChange={(event) => setDuePart("day", event.target.value)} placeholder="Dia" inputMode="numeric" />
                    <Input value={dueParts.month} onChange={(event) => setDuePart("month", event.target.value)} placeholder="Mes" inputMode="numeric" />
                    <Input value={dueParts.year} onChange={(event) => setDuePart("year", event.target.value)} placeholder="Ano" inputMode="numeric" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-destructive">{errors.dueDate?.message}</p>
                    <RememberCheckbox checked={remember.dueDay} onChange={(value) => setRemember({ ...remember, dueDay: value })} label="Lembrar dia" />
                  </div>
                </div>

                <Field label="Consumo Total" helper="Campo numerico em kWh" missing={missing("totalConsumptionKwh")}>
                  <Input type="number" step="0.001" {...register("totalConsumptionKwh", { valueAsNumber: true })} />
                </Field>
                <Field label="Energia solar consumida" error={errors.solarConsumptionKwh?.message} helper="Se nao localizado no PDF, o sistema replica temporariamente o total consumido." missing={missing("solarConsumptionKwh")}>
                  <Input type="number" step="0.001" {...register("solarConsumptionKwh", { valueAsNumber: true })} />
                </Field>
                {missing("solarConsumptionKwh") && watched.totalConsumptionKwh ? (
                  <Alert className="md:col-span-2 border-orange-200 bg-orange-50">
                    <AlertCircle className="size-4 text-orange-700" />
                    <AlertDescription>Atenção - este dado nao foi localizado na fatura e foi replicado do Total Consumido. Verifique e corrija se necessario.</AlertDescription>
                  </Alert>
                ) : null}
                <Field label="Credito solar total acumulado" helper="Aparece na fatura como observacao para o cliente.">
                  <Input type="number" step="0.001" {...register("accumulatedCreditKwh", { valueAsNumber: true })} />
                </Field>
                <Field label="Chave PIX para esta fatura">
                  <Input {...register("pixKey")} placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatoria" />
                </Field>
                <RememberCheckbox checked={remember.pixKey} onChange={(value) => setRemember({ ...remember, pixKey: value })} />
                <Field label="Recebedor desta fatura" error={errors.receiverName?.message}>
                  <Input {...register("receiverName")} placeholder="Nome completo do recebedor" />
                </Field>
                <RememberCheckbox checked={remember.receiverName} onChange={(value) => setRemember({ ...remember, receiverName: value })} />
                <Field label="Preco por kWh" helper="Defina o valor de cobranca por kWh Solar para cobrar seu cliente." error={errors.pricePerKwh?.message}>
                  <Input type="number" step="0.0001" {...register("pricePerKwh", { valueAsNumber: true })} />
                </Field>
                <RememberCheckbox checked={remember.pricePerKwh} onChange={(value) => setRemember({ ...remember, pricePerKwh: value })} />
                <Field label="Desconto (%)" helper="Incide somente sobre o valor da energia solar." error={errors.discountPercent?.message}>
                  <Input type="number" step="0.01" {...register("discountPercent", { valueAsNumber: true })} />
                </Field>
                <RememberCheckbox checked={remember.discountPercent} onChange={(value) => setRemember({ ...remember, discountPercent: value })} />
              </div>

              <Separator className="my-6" />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-slate-50 p-4">
                  <h3 className="font-medium text-slate-900">Fio B - Distribuicao</h3>
                  <p className="mt-1 text-xs text-muted-foreground">O desconto nao incide sobre o Fio B.</p>
                  <Input className="mt-3 bg-white" type="number" step="0.01" {...register("fioBValue", { valueAsNumber: true })} />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <RememberCheckbox checked={watched.chargeFioB} onChange={(value) => setValue("chargeFioB", value)} label="Cobrar Fio B" />
                    <RememberCheckbox checked={remember.fioB} onChange={(value) => setRemember({ ...remember, fioB: value })} />
                  </div>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4">
                  <h3 className="font-medium text-slate-900">Taxa de Iluminacao Publica</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Somada separadamente ao total.</p>
                  <Input className="mt-3 bg-white" type="number" step="0.01" {...register("publicLightingValue", { valueAsNumber: true })} />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <RememberCheckbox checked={watched.chargePublicLighting} onChange={(value) => setValue("chargePublicLighting", value)} label="Cobrar taxa" />
                    <RememberCheckbox checked={remember.publicLighting} onChange={(value) => setRemember({ ...remember, publicLighting: value })} />
                  </div>
                </div>

                <div className="rounded-lg border bg-slate-50 p-4">
                  <h3 className="font-medium text-slate-900">Fatura da concessionaria</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Somada por fora; inclui taxas e impostos quando configurado.</p>
                  <Input className="mt-3 bg-white" type="number" step="0.01" {...register("utilityBillValue", { valueAsNumber: true })} />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <RememberCheckbox checked={watched.chargeUtilityBill} onChange={(value) => setValue("chargeUtilityBill", value)} label="Somar ao total" />
                    <RememberCheckbox checked={remember.utilityBill} onChange={(value) => setRemember({ ...remember, utilityBill: value })} />
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Taxa adicional ou desconto adicional" description="Inclua ajustes extras em reais e remova itens antes de gerar a fatura." icon={Banknote}>
              <div className="grid gap-3 md:grid-cols-[150px_1fr_160px_auto]">
                <Select value={adjustmentDraft.type} onValueChange={(value) => setAdjustmentDraft({ ...adjustmentDraft, type: value as "fee" | "discount" })}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fee">Taxa</SelectItem>
                    <SelectItem value="discount">Desconto</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={adjustmentDraft.name} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, name: event.target.value })} placeholder="Nome da taxa/desconto" />
                <Input type="number" step="0.01" value={adjustmentDraft.amount} onChange={(event) => setAdjustmentDraft({ ...adjustmentDraft, amount: Number(event.target.value) })} placeholder="Valor em R$" />
                <Button type="button" onClick={addAdjustment}>
                  <Plus className="size-4" />
                  Adicionar
                </Button>
              </div>

              <div className="mt-4 divide-y rounded-lg border">
                {(watched.adjustments ?? []).length ? watched.adjustments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span>{item.type === "fee" ? "Taxa" : "Desconto"} - {item.name}</span>
                    <div className="flex items-center gap-3">
                      <strong>{formatCurrency(item.amount)}</strong>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeAdjustment(item.id)} aria-label="Remover ajuste">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                )) : <p className="p-3 text-sm text-muted-foreground">Nenhum ajuste adicional.</p>}
              </div>
            </Section>

            <Section title="Bandeira Tarifaria" description="O custo da concessionaria e calculado automaticamente: taxa da bandeira x kWh consumido." icon={CalendarDays}>
              <div className="grid gap-4 md:grid-cols-4">
                <Field label="Bandeira selecionada">
                  <Select value={watched.tariffFlag} onValueChange={(value) => setValue("tariffFlag", value as "green" | "yellow" | "red")}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Bandeira" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Verde</SelectItem>
                      <SelectItem value="yellow">Amarela</SelectItem>
                      <SelectItem value="red">Vermelha</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Verde R$/kWh">
                  <Input type="number" step="0.0001" {...register("tariffValues.green", { valueAsNumber: true })} />
                </Field>
                <Field label="Amarela R$/kWh">
                  <Input type="number" step="0.0001" {...register("tariffValues.yellow", { valueAsNumber: true })} />
                </Field>
                <Field label="Vermelha R$/kWh">
                  <Input type="number" step="0.0001" {...register("tariffValues.red", { valueAsNumber: true })} />
                </Field>
              </div>
              <Alert className="mt-4 border-blue-200 bg-blue-50">
                <AlertDescription>
                  {formatKwh(watched.solarConsumptionKwh ?? 0)} x {formatCurrency(preview.selectedTariffValue)} = {formatCurrency(preview.estimatedUtilityCost)}. Este dado ajuda a mostrar quanto o cliente esta economizando e forma o comparativo no PDF.
                </AlertDescription>
              </Alert>
            </Section>

            <Section title="Multa e juros de mora" description="Registre valores de faturas pagas em atraso. Eles entram automaticamente nesta fatura como pendentes." icon={AlertCircle}>
              <div className="grid gap-3 md:grid-cols-3">
                <Input value={lateFeeDraft.originalInvoiceReference} onChange={(event) => setLateFeeDraft({ ...lateFeeDraft, originalInvoiceReference: event.target.value })} placeholder="Mes de referencia" />
                <Input type="date" value={lateFeeDraft.originalDueDate} onChange={(event) => setLateFeeDraft({ ...lateFeeDraft, originalDueDate: event.target.value })} />
                <Input type="date" value={lateFeeDraft.paymentDate} onChange={(event) => setLateFeeDraft({ ...lateFeeDraft, paymentDate: event.target.value })} />
                <Input type="number" step="0.01" value={lateFeeDraft.originalAmount} onChange={(event) => setLateFeeDraft({ ...lateFeeDraft, originalAmount: Number(event.target.value) })} placeholder="Valor da fatura" />
                <Input type="number" step="0.01" value={lateFeeDraft.finePercent} onChange={(event) => setLateFeeDraft({ ...lateFeeDraft, finePercent: Number(event.target.value) })} placeholder="% multa" />
                <Input type="number" step="0.01" value={lateFeeDraft.interestPercent} onChange={(event) => setLateFeeDraft({ ...lateFeeDraft, interestPercent: Number(event.target.value) })} placeholder="% juros" />
                <Select value={lateFeeDraft.interestType} onValueChange={(value) => setLateFeeDraft({ ...lateFeeDraft, interestType: value as "monthly" | "daily" })}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue placeholder="Tipo de juros" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal, a.m.</SelectItem>
                    <SelectItem value="daily">Diario, a.d.</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" onClick={addLateFee}>
                  <Save className="size-4" />
                  Salvar multa/juros
                </Button>
              </div>

              <div className="mt-4 divide-y rounded-lg border">
                {(watched.lateFees ?? []).length ? watched.lateFees.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span>{item.originalInvoiceReference} - {item.daysLate} dias de atraso</span>
                    <div className="flex items-center gap-3">
                      <strong>{formatCurrency(item.totalAmount)}</strong>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLateFee(item.id)} aria-label="Remover multa">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                )) : <p className="p-3 text-sm text-muted-foreground">Nenhuma multa ou juros pendente.</p>}
              </div>
            </Section>

            <Section title="Observacoes" description="Mensagem personalizada exibida no PDF final." icon={FileText}>
              <Textarea {...register("notes")} rows={4} placeholder="Mensagem para o cliente" />
            </Section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
              <CardHeader>
                <CardTitle>Pre-visualizacao</CardTitle>
                <CardDescription>Calculo simples atualizado em tempo real.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-slate-950 p-4 text-white">
                  <p className="text-xs text-slate-300">Valor final</p>
                  <p className="mt-1 text-3xl font-semibold">{formatCurrency(preview.finalTotal)}</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><span>{formatKwh(watched.solarConsumptionKwh ?? 0)} x {formatCurrency(watched.pricePerKwh ?? 0)}</span><strong>{formatCurrency(preview.energySubtotal)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Desconto aplicado</span><strong>-{formatCurrency(preview.discountValue)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Bandeira tarifaria</span><strong>{formatCurrency(preview.tariffFlagCost)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Outras taxas</span><strong>{formatCurrency(previewFeesWithoutTariff)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Descontos extras</span><strong>-{formatCurrency(preview.totalExtraDiscounts)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Multa e juros</span><strong>{formatCurrency(preview.totalLateFees)}</strong></div>
                </div>
                <Separator />
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
                  <p className="font-medium">Economia estimada</p>
                  <p>{formatCurrency(preview.estimatedSavings)}{preview.savingsPercent !== null ? ` (${preview.savingsPercent.toFixed(2)}%)` : ""}</p>
                </div>
                <Button type="submit" className="h-10 w-full bg-orange-600 text-white hover:bg-orange-700" disabled={generatingPdf}>
                  {generatingPdf ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Gerar Fatura Solar
                </Button>
                {pdfUrl ? (
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                    <FileText className="size-4" />
                    Baixar / abrir PDF gerado
                  </a>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </form>
      </div>
    </div>
  );
}
