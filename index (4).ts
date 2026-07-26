import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { requiredEnv } from "./http.ts";

export function userClient(req: Request): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(req: Request): Promise<{
  client: SupabaseClient;
  user: User;
}> {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("يجب تسجيل الدخول لإكمال العملية");
  return { client, user: data.user };
}

export async function requirePermission(
  req: Request,
  permission: string,
  branchId?: string | null,
) {
  const context = await requireUser(req);
  const { data, error } = await context.client.rpc("has_permission", {
    p_permission: permission,
    p_branch_id: branchId ?? null,
  });
  if (error || data !== true) throw new Error("ليس لديك صلاحية لتنفيذ هذه العملية");
  return context;
}

