import { NextResponse } from "next/server";
import { clientSchema } from "@/lib/solar/schemas";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = clientSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const client = parsed.data;

  if (!supabase) {
    return NextResponse.json({
      client: { id: "local-preview-client", ...client },
      warning: "Supabase nao configurado. Retornando cliente local para pre-visualizacao.",
    });
  }

  const payload = {
      user_id: userId,
      uc_code: client.ucCode,
      name: client.name,
      document: client.document || null,
      email: client.email || null,
      phone: client.phone || null,
      address: client.address || null,
  };

  const query = client.id
    ? supabase
      .from("clients")
      .update(payload)
      .eq("id", client.id)
      .eq("user_id", userId)
      .select("*")
      .single()
    : supabase
      .from("clients")
      .upsert(payload, { onConflict: "user_id,uc_code" })
      .select("*")
      .single();

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ client: data });
}
