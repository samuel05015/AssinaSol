"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { ArrowRight, FileUp, Loader2, Pencil, Printer, Save, Search, Trash2, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";

import { ProtectedShell } from "@/components/auth/protected-shell";
import { useAuth } from "@/components/auth/auth-provider";
import { pendingClientStorageKey } from "@/components/solar/add-client-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { clientSchema, type ClientSchema } from "@/lib/solar/schemas";
import { maskBrazilianPhone, maskCpfCnpj } from "@/lib/solar/format";
import { cn } from "@/lib/utils";
import type { ClientData } from "@/lib/solar/types";

type ClientListItem = ClientData & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type ClientsResponse = {
  clients: ClientListItem[];
  warning?: string;
  error?: string | Record<string, unknown>;
};

const clientResolver = zodResolver(clientSchema) as Resolver<ClientSchema>;

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function secondaryText(...values: Array<string | undefined>) {
  const filled = values.filter(Boolean);
  return filled.length ? filled.join(" | ") : "Sem contato informado";
}

function clientToForm(client: ClientListItem): ClientSchema {
  return {
    id: client.id,
    ucCode: client.ucCode,
    name: client.name,
    document: client.document ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
  };
}

function clientToStorage(client: ClientListItem) {
  return JSON.stringify(clientToForm(client));
}

function errorMessage(error: string | Record<string, unknown> | undefined, fallback: string) {
  return typeof error === "string" ? error : fallback;
}

export function ClientList() {
  const router = useRouter();
  const { getAuthHeaders } = useAuth();
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingClient, setEditingClient] = useState<ClientListItem | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const editForm = useForm<ClientSchema>({
    resolver: clientResolver,
    defaultValues: {
      id: "",
      ucCode: "",
      name: "",
      document: "",
      email: "",
      phone: "",
      address: "",
    },
  });

  const {
    register,
    setValue,
    reset,
    handleSubmit,
    control,
    formState: { errors: editErrors },
  } = editForm;

  const editDocument = useWatch({ control, name: "document" });
  const editPhone = useWatch({ control, name: "phone" });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());

        const response = await fetch(`/api/clients${params.toString() ? `?${params}` : ""}`, {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });
        const data = await response.json() as ClientsResponse;

        if (!response.ok) {
          throw new Error(errorMessage(data.error, "Nao foi possivel carregar os clientes."));
        }

        setClients(data.clients ?? []);
        if (data.warning) toast.warning(data.warning);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "Nao foi possivel carregar os clientes.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [getAuthHeaders, search]);

  const totalWithContact = useMemo(() => clients.filter((client) => client.email || client.phone).length, [clients]);

  function handleUseClientOnInvoice(client: ClientListItem) {
    localStorage.setItem(pendingClientStorageKey, clientToStorage(client));
    router.push("/carregar-fatura");
  }

  function handlePrintProposal(client: ClientListItem) {
    localStorage.setItem(pendingClientStorageKey, clientToStorage(client));
    toast.info("Cliente carregado. Complete os dados de cobranca e gere a proposta.");
    router.push("/carregar-fatura");
  }

  function openEdit(client: ClientListItem) {
    setEditingClient(client);
    reset(clientToForm(client));
  }

  async function submitEdit(values: ClientSchema) {
    setSavingEdit(true);
    try {
      const response = await fetch("/api/clients/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(values),
      });
      const data = await response.json() as { client?: Record<string, unknown>; error?: string | Record<string, unknown>; warning?: string };
      if (!response.ok) throw new Error(errorMessage(data.error, "Nao foi possivel atualizar o cliente."));

      const updatedClient: ClientListItem = {
        id: String(data.client?.id ?? values.id ?? ""),
        ucCode: String(data.client?.uc_code ?? values.ucCode),
        name: String(data.client?.name ?? values.name),
        document: String(data.client?.document ?? values.document ?? ""),
        email: String(data.client?.email ?? values.email ?? ""),
        phone: String(data.client?.phone ?? values.phone ?? ""),
        address: String(data.client?.address ?? values.address ?? ""),
        createdAt: String(data.client?.created_at ?? editingClient?.createdAt ?? new Date().toISOString()),
        updatedAt: String(data.client?.updated_at ?? new Date().toISOString()),
      };

      setClients((current) => current.map((client) => client.id === updatedClient.id ? updatedClient : client));
      setEditingClient(null);
      toast.success(data.warning ?? "Cliente atualizado.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Nao foi possivel atualizar o cliente.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteClient(client: ClientListItem) {
    const confirmed = window.confirm(`Excluir o cliente "${client.name}"? Esta acao nao remove faturas ja geradas.`);
    if (!confirmed) return;

    setDeletingId(client.id);
    try {
      const response = await fetch(`/api/clients?id=${encodeURIComponent(client.id)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json() as { ok?: boolean; error?: string; warning?: string };
      if (!response.ok) throw new Error(data.error ?? "Nao foi possivel excluir o cliente.");

      setClients((current) => current.filter((item) => item.id !== client.id));
      toast.success(data.warning ?? "Cliente excluido.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Nao foi possivel excluir o cliente.");
    } finally {
      setDeletingId("");
    }
  }

  function ClientActions({ client, mobile = false }: { client: ClientListItem; mobile?: boolean }) {
    return (
      <div className={cn("flex gap-2", mobile ? "mt-4 grid grid-cols-2" : "justify-end")}>
        <Button type="button" size="sm" variant={mobile ? "outline" : "default"} onClick={() => handleUseClientOnInvoice(client)}>
          <ArrowRight className="size-4" />
          Usar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(client)}>
          <Pencil className="size-4" />
          Editar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => handlePrintProposal(client)}>
          <Printer className="size-4" />
          Proposta
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => deleteClient(client)} disabled={deletingId === client.id}>
          {deletingId === client.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Excluir
        </Button>
      </div>
    );
  }

  return (
    <ProtectedShell>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-lg bg-slate-950 p-6 text-white shadow-sm">
          <Badge className="mb-4 bg-orange-500 text-white hover:bg-orange-500">Banco de clientes</Badge>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Clientes cadastrados</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Consulte clientes por nome, UC, documento, contato ou endereco e use o cadastro para iniciar uma nova fatura solar.
              </p>
            </div>
            <Link href="/clientes/novo" className={cn(buttonVariants(), "bg-orange-600 text-white hover:bg-orange-700")}>
              <UserPlus className="size-4" />
              Adicionar cliente
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <UsersRound className="size-5 text-orange-600" />
              <CardTitle>{clients.length}</CardTitle>
              <CardDescription>Clientes nesta consulta</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <FileUp className="size-5 text-orange-600" />
              <CardTitle>{totalWithContact}</CardTitle>
              <CardDescription>Com e-mail ou telefone</CardDescription>
            </CardHeader>
          </Card>
          <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
            <CardHeader>
              <Search className="size-5 text-orange-600" />
              <CardTitle>Busca rapida</CardTitle>
              <CardDescription>Nome, UC, documento, contato ou endereco</CardDescription>
            </CardHeader>
          </Card>
        </section>

        <Card className="rounded-lg border-0 shadow-sm ring-slate-200">
          <CardHeader>
            <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-end">
              <div>
                <CardTitle>Listagem de clientes</CardTitle>
                <CardDescription>Os resultados sao ordenados pelos cadastros atualizados mais recentemente.</CardDescription>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="bg-white pl-9"
                  placeholder="Buscar cliente"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center gap-3 rounded-lg border bg-slate-50 p-10 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                Carregando clientes...
              </div>
            ) : clients.length ? (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>UC</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Endereco</TableHead>
                        <TableHead>Atualizado</TableHead>
                        <TableHead className="text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div className="font-medium text-slate-950">{client.name}</div>
                            <div className="text-xs text-muted-foreground">{client.document || "Sem CPF/CNPJ"}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{client.ucCode}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-muted-foreground">
                            {secondaryText(client.email, client.phone)}
                          </TableCell>
                          <TableCell className="max-w-[260px] truncate text-muted-foreground">{client.address || "-"}</TableCell>
                          <TableCell>{formatDate(client.updatedAt)}</TableCell>
                          <TableCell>
                            <ClientActions client={client} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-3 md:hidden">
                  {clients.map((client) => (
                    <div key={client.id} className="rounded-lg border bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-950">{client.name}</p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">UC {client.ucCode}</p>
                        </div>
                        <Badge variant="outline">{formatDate(client.updatedAt)}</Badge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{secondaryText(client.email, client.phone)}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{client.address || "Sem endereco informado"}</p>
                      <ClientActions client={client} mobile />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed bg-slate-50 p-10 text-center">
                <UsersRound className="mx-auto size-8 text-muted-foreground" />
                <h2 className="mt-4 font-medium text-slate-950">Nenhum cliente encontrado</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cadastre um cliente novo ou ajuste a busca para encontrar registros existentes.
                </p>
                <Link href="/clientes/novo" className={cn(buttonVariants(), "mt-5 bg-orange-600 text-white hover:bg-orange-700")}>
                  <UserPlus className="size-4" />
                  Adicionar cliente
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(editingClient)} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar cliente</DialogTitle>
              <DialogDescription>Atualize os dados do cliente. Nome e UC continuam obrigatorios.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submitEdit)}>
              <input type="hidden" {...register("id")} />
              <div className="space-y-1.5">
                <Label>Unidade Consumidora (UC)</Label>
                <Input {...register("ucCode")} />
                {editErrors.ucCode ? <p className="text-xs text-destructive">{editErrors.ucCode.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>Nome do cliente</Label>
                <Input {...register("name")} />
                {editErrors.name ? <p className="text-xs text-destructive">{editErrors.name.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input
                  value={editDocument ?? ""}
                  onChange={(event) => setValue("document", maskCpfCnpj(event.target.value), { shouldValidate: true })}
                />
                {editErrors.document ? <p className="text-xs text-destructive">{editErrors.document.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input {...register("email")} type="email" />
                {editErrors.email ? <p className="text-xs text-destructive">{editErrors.email.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={editPhone ?? ""}
                  onChange={(event) => setValue("phone", maskBrazilianPhone(event.target.value))}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Endereco</Label>
                <Textarea {...register("address")} rows={3} />
              </div>
              <DialogFooter className="md:col-span-2">
                <Button type="button" variant="outline" onClick={() => setEditingClient(null)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-orange-600 text-white hover:bg-orange-700" disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Salvar alteracoes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedShell>
  );
}
