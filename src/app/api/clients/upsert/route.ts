import { NextResponse } from "next/server";
import { billingRequiredMessage, getBillingState } from "@/lib/billing/server";
import { clientSchema } from "@/lib/solar/schemas";
import { getRequestUserId, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ExistingClientRow = {
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

function keepExistingWhenBlank(value: string | undefined, existing: string | null | undefined) {
  return value?.trim() || existing || null;
}

export async function POST(request: Request) {
  const parsed = clientSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const userId = await getRequestUserId(request);
  const client = parsed.data;
  const billing = await getBillingState(supabase, userId);

  if (!billing.access.canSaveClients) {
    return NextResponse.json({ error: billingRequiredMessage("clients") }, { status: 402 });
  }

  if (!supabase) {
    return NextResponse.json({
      client: { id: "local-preview-client", ...client },
      warning: "Supabase nao configurado. Retornando cliente local para pre-visualizacao.",
    });
  }

  let existingClient: ExistingClientRow | null = null;

  if (client.id) {
    const { data } = await supabase
      .from("clients")
      .select("document, email, phone, address")
      .eq("id", client.id)
      .eq("user_id", userId)
      .maybeSingle();

    existingClient = data as ExistingClientRow | null;
  } else {
    const { data } = await supabase
      .from("clients")
      .select("document, email, phone, address")
      .eq("user_id", userId)
      .eq("uc_code", client.ucCode)
      .maybeSingle();

    existingClient = data as ExistingClientRow | null;
  }

  const payload = {
      user_id: userId,
      uc_code: client.ucCode,
      name: client.name,
      document: keepExistingWhenBlank(client.document, existingClient?.document),
      email: keepExistingWhenBlank(client.email, existingClient?.email),
      phone: keepExistingWhenBlank(client.phone, existingClient?.phone),
      address: keepExistingWhenBlank(client.address, existingClient?.address),
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
