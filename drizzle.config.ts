import { z } from "npm:zod@4";
import { idempotencyKey, json, options, publicError, requiredEnv } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validators.ts";

const schema = z.object({ asset_id: uuid, add_white_outline: z.boolean().default(false) });

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  const admin = adminClient();
  let assetId: string | null = null;
  try {
    idempotencyKey(req);
    const body = schema.parse(await req.json());
    assetId = body.asset_id;
    const { user } = await requireUser(req);
    const apiUrl = requiredEnv("BACKGROUND_REMOVAL_API_URL");
    const apiKey = requiredEnv("BACKGROUND_REMOVAL_API_KEY");
    const { data: asset, error } = await admin
      .from("customer_assets")
      .select("id, customer_id, original_path, processing_status")
      .eq("id", body.asset_id)
      .eq("customer_id", user.id)
      .single();
    if (error || !asset) throw new Error("الصورة غير موجودة");
    if (asset.processing_status === "processing") {
      return json({ asset_id: asset.id, status: "processing", replayed: true });
    }
    await admin.from("customer_assets").update({
      processing_status: "processing",
      processing_error: null,
    }).eq("id", asset.id);

    const { data: file, error: downloadError } = await admin.storage
      .from("customer-assets")
      .download(asset.original_path);
    if (downloadError || !file) throw new Error("تعذر قراءة الصورة الأصلية");
    const form = new FormData();
    form.append("image_file", file, "customer-upload");
    form.append("format", "png");
    form.append("add_white_outline", String(body.add_white_outline));
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("background removal provider", response.status, detail.slice(0, 500));
      throw new Error("فشلت خدمة إزالة الخلفية");
    }
    const processed = await response.blob();
    if (!processed.type.includes("png") && !processed.type.includes("webp")) {
      throw new Error("أعادت خدمة إزالة الخلفية ملفًا غير صالح");
    }
    const processedPath = `${user.id}/processed/${asset.id}.png`;
    const { error: uploadError } = await admin.storage
      .from("customer-assets")
      .upload(processedPath, processed, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message);
    await admin.from("customer_assets").update({
      processed_path: processedPath,
      processing_status: "completed",
    }).eq("id", asset.id);
    return json({ asset_id: asset.id, status: "completed", processed_path: processedPath });
  } catch (error) {
    if (assetId) {
      await admin.from("customer_assets").update({
        processing_status: "failed",
        processing_error: error instanceof Error ? error.message.slice(0, 500) : "فشل غير معروف",
      }).eq("id", assetId);
    }
    console.error("remove-background", error);
    return publicError(error);
  }
});
