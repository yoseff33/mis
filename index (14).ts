import { z } from "npm:zod@4";
import { json, options, publicError, requiredEnv } from "../_shared/http.ts";
import { adminClient, requirePermission } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validators.ts";

const schema = z.object({ asset_id: uuid });

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  try {
    const body = schema.parse(await req.json());
    await requirePermission(req, "assets.review");
    const admin = adminClient();
    const { data: asset, error } = await admin
      .from("customer_assets")
      .select("id, original_path")
      .eq("id", body.asset_id)
      .single();
    if (error) throw new Error("الصورة غير موجودة");
    const { data: signed, error: signedError } = await admin.storage
      .from("customer-assets")
      .createSignedUrl(asset.original_path, 300);
    if (signedError) throw new Error("تعذر قراءة الصورة للمراجعة");
    const response = await fetch(requiredEnv("IMAGE_MODERATION_API_URL"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("IMAGE_MODERATION_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: signed.signedUrl }),
    });
    const result = await response.json().catch(() => ({})) as {
      safe?: boolean;
      flagged?: boolean;
      reason?: string;
    };
    if (!response.ok) throw new Error("فشلت خدمة فحص الصور");
    const status = result.safe && !result.flagged ? "approved" : "flagged";
    await admin.from("customer_assets").update({
      moderation_status: status,
      rejection_reason: result.reason ?? null,
    }).eq("id", asset.id);
    return json({ asset_id: asset.id, moderation_status: status, reason: result.reason ?? null });
  } catch (error) {
    console.error("image-screen", error);
    return publicError(error);
  }
});

