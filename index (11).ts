import { z } from "npm:zod@4";
import { json, options, publicError } from "../_shared/http.ts";
import { adminClient, requirePermission, requireUser } from "../_shared/supabase.ts";
import { randomToken, sha256 } from "../_shared/crypto.ts";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rotate") }),
  z.object({ action: z.literal("verify"), token: z.string().min(32).max(256) }),
]);

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  try {
    const body = schema.parse(await req.json());
    const admin = adminClient();
    if (body.action === "rotate") {
      const { user } = await requireUser(req);
      const token = randomToken();
      const tokenHash = await sha256(token);
      await admin
        .from("customer_qr_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("customer_id", user.id)
        .is("revoked_at", null);
      const { error } = await admin.from("customer_qr_tokens").insert({
        customer_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      });
      if (error) throw new Error(error.message);
      return json({ token, expires_in_seconds: 2592000 });
    }

    await requirePermission(req, "customers.read");
    const tokenHash = await sha256(body.token);
    const { data: tokenRow, error } = await admin
      .from("customer_qr_tokens")
      .select("id, customer_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (error || !tokenRow || (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date())) {
      return json({ error: "رمز QR غير صالح أو منتهي" }, 404);
    }
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, member_number, phone, status")
      .eq("id", tokenRow.customer_id)
      .single();
    if (profileError) throw new Error(profileError.message);
    await admin.from("customer_qr_tokens").update({
      last_used_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);
    await admin.from("audit_logs").insert({
      action: "customer_qr_verified",
      table_name: "profiles",
      record_id: profile.id,
      new_data: { source: "customer_qr" },
    });
    return json({ customer: profile });
  } catch (error) {
    console.error("customer-qr", error);
    return publicError(error);
  }
});

