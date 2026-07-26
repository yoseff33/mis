import { z } from "npm:zod@4";
import { json, options, publicError } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validators.ts";

const elementSchema = z.object({
  type: z.enum(["sticker", "customer_asset", "text"]),
  sticker_id: uuid.optional(),
  customer_asset_id: uuid.optional(),
  text: z.string().max(80).optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().min(-360).max(360).default(0),
  scale_x: z.number().min(-10).max(10).default(1),
  scale_y: z.number().min(-10).max(10).default(1),
  z_index: z.number().int().min(0).max(1000),
  opacity: z.number().min(0.1).max(1).default(1),
  flip_x: z.boolean().default(false),
  flip_y: z.boolean().default(false),
}).superRefine((element, ctx) => {
  if (element.type === "sticker" && !element.sticker_id) {
    ctx.addIssue({ code: "custom", message: "معرف الملصق مطلوب" });
  }
  if (element.type === "customer_asset" && !element.customer_asset_id) {
    ctx.addIssue({ code: "custom", message: "معرف صورة العميل مطلوب" });
  }
});

const schema = z.object({
  design_id: uuid.nullish(),
  name: z.string().trim().min(1).max(80),
  canvas_width: z.number().int().min(300).max(2400),
  canvas_height: z.number().int().min(180).max(1600),
  elements: z.array(elementSchema).max(30),
  background: z.record(z.string(), z.unknown()).default({}),
  make_active: z.boolean().default(true),
});

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  try {
    const body = schema.parse(await req.json());
    const { client, user } = await requireUser(req);
    const stickerIds = body.elements.flatMap((element) => element.sticker_id ? [element.sticker_id] : []);
    const assetIds = body.elements.flatMap((element) => element.customer_asset_id ? [element.customer_asset_id] : []);
    if (stickerIds.length) {
      const { data, error } = await client.from("stickers").select("id").in("id", stickerIds);
      if (error || new Set(data?.map((row) => row.id)).size !== new Set(stickerIds).size) {
        throw new Error("يتضمن التصميم ملصقًا غير متاح");
      }
    }
    if (assetIds.length) {
      const { data, error } = await client
        .from("customer_assets")
        .select("id")
        .eq("customer_id", user.id)
        .eq("processing_status", "completed")
        .in("id", assetIds);
      if (error || new Set(data?.map((row) => row.id)).size !== new Set(assetIds).size) {
        throw new Error("يتضمن التصميم صورة خاصة غير متاحة");
      }
    }
    const { data, error } = await client.rpc("save_card_design_version", {
      p_design_id: body.design_id ?? null,
      p_name: body.name,
      p_canvas_width: body.canvas_width,
      p_canvas_height: body.canvas_height,
      p_elements: body.elements,
      p_background: body.background,
      p_make_active: body.make_active,
    });
    if (error) throw new Error(error.message);
    return json({ design: data }, 201);
  } catch (error) {
    console.error("validate-card-design", error);
    return publicError(error);
  }
});

