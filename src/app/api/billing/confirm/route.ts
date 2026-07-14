import { NextResponse } from "next/server";
import { getBillingState } from "@/lib/billing/server";
import { getStripe, syncCheckoutSession } from "@/lib/billing/stripe";
import { getAuthenticatedRequestUser, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthenticatedRequestUser(request);
  if (!user) return NextResponse.json({ error: "Sessao de usuario invalida." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (typeof body.sessionId !== "string" || !body.sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Sessao de pagamento invalida." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase nao configurado." }, { status: 503 });

  try {
    const session = await getStripe().checkout.sessions.retrieve(body.sessionId, {
      expand: ["subscription"],
    });
    if (session.client_reference_id !== user.id) {
      return NextResponse.json({ error: "Esta assinatura pertence a outro usuario." }, { status: 403 });
    }

    await syncCheckoutSession(supabase, session);
    return NextResponse.json({
      ...(await getBillingState(supabase, user.id)),
      message: "Pagamento cadastrado e teste gratis ativado.",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Nao foi possivel confirmar a assinatura.",
    }, { status: 500 });
  }
}
