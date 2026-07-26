import { z } from "npm:zod@4";
import { json, options, publicError } from "../_shared/http.ts";
import { adminClient, requirePermission } from "../_shared/supabase.ts";
import { randomToken, sha256 } from "../_shared/crypto.ts";
import { uuid } from "../_shared/validators.ts";

const schema = z.object({ parking_spot_id: uuid });

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  try {
    const body = schema.parse(await req.json());
    const admin = adminClient();
    const { data: spot, error } = await admin
      .from("parking_spots")
      .select("id, branch_id, code")
      .eq("id", body.parking_spot_id)
      .single();
    if (error) throw new Error("الموقف غير موجود");
    await requirePermission(req, "branches.manage", spot.branch_id);
    const token = randomToken();
    const tokenHash = await sha256(token);
    const { error: updateError } = await admin
      .from("parking_spots")
      .update({ qr_token_hash: tokenHash })
      .eq("id", spot.id);
    if (updateError) throw new Error(updateError.message);
    const appUrl = Deno.env.get("APP_URL") ?? Deno.env.get("NEXT_PUBLIC_APP_URL");
    if (!appUrl) throw new Error("لم يتم تفعيل رابط التطبيق العام");
    return json({
      qr_value: `${appUrl.replace(/\/$/, "")}/menu?parking=${encodeURIComponent(token)}`,
      branch_id: spot.branch_id,
      parking_code: spot.code,
    });
  } catch (error) {
    console.error("parking-qr", error);
    return publicError(error);
  }
});

