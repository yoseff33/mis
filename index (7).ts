import { z } from "npm:zod@4";
import { json, options, publicError } from "../_shared/http.ts";
import { adminClient, requirePermission } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validators.ts";

const schema = z.object({
  campaign_id: uuid,
  branch_id: uuid.nullish(),
  min_orders: z.number().int().min(0).optional(),
  min_spend: z.number().min(0).optional(),
  inactive_days: z.number().int().min(1).optional(),
  loyalty_level: z.string().max(50).optional(),
});

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  const admin = adminClient();
  try {
    const body = schema.parse(await req.json());
    await requirePermission(req, "marketing.manage", body.branch_id ?? null);
    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .select("id, branch_id, status")
      .eq("id", body.campaign_id)
      .single();
    if (campaignError || !campaign || campaign.status !== "draft") {
      throw new Error("الحملة غير متاحة لبناء الشريحة");
    }
    const { data: consents, error: consentError } = await admin
      .from("customer_marketing_consents")
      .select("customer_id")
      .eq("channel", "whatsapp")
      .eq("consented", true)
      .limit(50000);
    if (consentError) throw new Error(consentError.message);
    const consentedIds = consents.map((row) => row.customer_id);
    if (!consentedIds.length) {
      await admin.from("campaigns").update({ target_count: 0 }).eq("id", campaign.id);
      return json({ target_count: 0 });
    }

    const qualifying: string[] = [];
    for (let offset = 0; offset < consentedIds.length; offset += 500) {
      const ids = consentedIds.slice(offset, offset + 500);
      let ordersQuery = admin
        .from("orders")
        .select("customer_id,total,created_at,status")
        .in("customer_id", ids)
        .in("status", ["delivered", "partially_refunded"]);
      if (body.branch_id) ordersQuery = ordersQuery.eq("branch_id", body.branch_id);
      const { data: orders, error } = await ordersQuery;
      if (error) throw new Error(error.message);
      const stats = new Map<string, { orders: number; spend: number; latest: number }>();
      for (const order of orders) {
        const current = stats.get(order.customer_id) ?? { orders: 0, spend: 0, latest: 0 };
        current.orders += 1;
        current.spend += Number(order.total);
        current.latest = Math.max(current.latest, new Date(order.created_at).getTime());
        stats.set(order.customer_id, current);
      }
      for (const id of ids) {
        const stat = stats.get(id) ?? { orders: 0, spend: 0, latest: 0 };
        if (body.min_orders != null && stat.orders < body.min_orders) continue;
        if (body.min_spend != null && stat.spend < body.min_spend) continue;
        if (
          body.inactive_days != null &&
          stat.latest > Date.now() - body.inactive_days * 86400000
        ) continue;
        qualifying.push(id);
      }
    }
    if (qualifying.length) {
      const rows = qualifying.map((customerId) => ({
        campaign_id: campaign.id,
        customer_id: customerId,
        consent_snapshot: true,
      }));
      for (let offset = 0; offset < rows.length; offset += 500) {
        const { error } = await admin.from("campaign_audiences")
          .upsert(rows.slice(offset, offset + 500), { onConflict: "campaign_id,customer_id" });
        if (error) throw new Error(error.message);
      }
    }
    await admin.from("campaigns").update({
      audience_definition: body,
      target_count: qualifying.length,
    }).eq("id", campaign.id);
    return json({ target_count: qualifying.length });
  } catch (error) {
    console.error("campaign-audience", error);
    return publicError(error);
  }
});

