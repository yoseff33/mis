import { z } from "npm:zod@4";
import { json, options, publicError } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validators.ts";

const schema = z.object({
  order_id: uuid,
  to_status: z.enum([
    "pending_payment",
    "payment_failed",
    "paid",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
    "partially_refunded",
  ]),
  reason: z.string().trim().min(3).max(500).optional(),
});

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  try {
    const body = schema.parse(await req.json());
    const { client } = await requireUser(req);
    const { data, error } = await client.rpc("transition_order", {
      p_order_id: body.order_id,
      p_to_status: body.to_status,
      p_reason: body.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return json({ order: data });
  } catch (error) {
    console.error("transition-order", error);
    return publicError(error);
  }
});

