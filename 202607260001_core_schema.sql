import { z } from "npm:zod@4";
import { json, options, publicError } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validators.ts";

const schema = z.object({
  customer_id: uuid,
  program_id: uuid,
  branch_id: uuid.nullish(),
  cups_delta: z.number().int().min(-20).max(20).refine((value) => value !== 0),
  reason: z.string().trim().min(4).max(500),
});

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  try {
    const body = schema.parse(await req.json());
    const { client } = await requireUser(req);
    const { data, error } = await client.rpc("adjust_loyalty", {
      p_customer_id: body.customer_id,
      p_program_id: body.program_id,
      p_cups_delta: body.cups_delta,
      p_reason: body.reason,
      p_branch_id: body.branch_id ?? null,
    });
    if (error) throw new Error(error.message);
    return json({ loyalty: data });
  } catch (error) {
    console.error("loyalty-adjust", error);
    return publicError(error);
  }
});

