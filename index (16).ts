import { json, options, publicError, requiredEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { setupSchema } from "../_shared/validators.ts";

function timingSafeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);

  const admin = adminClient();
  let createdUserId: string | null = null;
  try {
    const suppliedToken = req.headers.get("x-setup-token") ?? "";
    if (!timingSafeEqual(suppliedToken, requiredEnv("INITIAL_SETUP_TOKEN"))) {
      return json({ error: "رمز التأسيس غير صحيح" }, 403);
    }

    const { data: existing } = await admin
      .from("system_settings")
      .select("id")
      .eq("key", "setup_completed")
      .eq("value", true)
      .maybeSingle();
    if (existing) return json({ error: "تم إعداد النظام مسبقًا" }, 409);

    const payload = setupSchema.parse(await req.json());
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: payload.admin.email,
      password: payload.admin.password,
      email_confirm: true,
      user_metadata: { full_name: payload.admin.full_name },
    });
    if (createError || !created.user) {
      throw new Error(createError?.message ?? "تعذر إنشاء حساب المدير");
    }
    createdUserId = created.user.id;

    const { data, error } = await admin.rpc("initial_setup_atomic", {
      p_admin_user_id: createdUserId,
      p_payload: payload,
    });
    if (error) throw new Error(error.message);

    return json({ setup: data }, 201);
  } catch (error) {
    if (createdUserId) {
      const { error: rollbackError } = await admin.auth.admin.deleteUser(createdUserId);
      if (rollbackError) console.error("initial-setup rollback", rollbackError);
    }
    console.error("initial-setup", error);
    return publicError(error);
  }
});

