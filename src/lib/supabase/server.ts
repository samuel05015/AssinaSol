import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return supabaseAdmin;
}

export async function getRequestUserId(request: Request) {
  const supabase = getSupabaseAdmin();
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (supabase && token) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user?.id) return data.user.id;
  }

  return request.headers.get("x-user-id")
    || process.env.SOLAR_DEMO_USER_ID
    || "00000000-0000-0000-0000-000000000000";
}

