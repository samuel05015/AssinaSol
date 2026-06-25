import { NextResponse } from "next/server";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ClientRow = {
  id: string;
  uc_code: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

function toClient(row: ClientRow) {
  return {
    id: row.id,
    ucCode: row.uc_code,
    name: row.name,
    document: row.document ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sanitizeSearch(value: string | null) {
  return (value ?? "").trim().replace(/[,%]/g, " ");
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const search = sanitizeSearch(new URL(request.url).searchParams.get("search"));

  if (!supabase) {
    return NextResponse.json({
      clients: [],
      warning: "Supabase nao configurado. Cadastros locais de preview nao ficam persistidos na listagem.",
    });
  }

  let query = supabase
    .from("clients")
    .select("id, uc_code, name, document, email, phone, address, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (search) {
    const term = `%${search}%`;
    query = query.or([
      `uc_code.ilike.${term}`,
      `name.ilike.${term}`,
      `document.ilike.${term}`,
      `email.ilike.${term}`,
      `phone.ilike.${term}`,
      `address.ilike.${term}`,
    ].join(","));
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: (data ?? []).map((row) => toClient(row as ClientRow)) });
}

export async function DELETE(request: Request) {
  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Informe o cliente para excluir." }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({
      ok: true,
      warning: "Supabase nao configurado. Cliente removido apenas da tela local.",
    });
  }

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
