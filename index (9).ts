import { json, options, publicError, idempotencyKey } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { orderSchema } from "../_shared/validators.ts";

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);

  try {
    const key = idempotencyKey(req);
    const payload = orderSchema.parse(await req.json());
    const { client } = await requireUser(req);
    const { data, error } = await client.rpc("create_order_atomic", {
      p_payload: payload,
      p_idempotency_key: key,
    });
    if (error) throw new Error(error.message);
    return json({ order: data }, data?.replayed ? 200 : 201);
  } catch (error) {
    console.error("create-order", error);
    return publicError(error);
  }
});

