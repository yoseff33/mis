import { z } from "npm:zod@4";
import { idempotencyKey, json, options, publicError, requiredEnv } from "../_shared/http.ts";
import { adminClient, requirePermission } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validators.ts";

const schema = z.object({
  customer_id: uuid,
  template_id: uuid,
  order_id: uuid.nullish(),
  campaign_id: uuid.nullish(),
  purpose: z.enum(["transactional", "marketing"]),
  parameters: z.array(z.string().max(500)).max(20).default([]),
});

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  const admin = adminClient();
  try {
    const key = idempotencyKey(req);
    const body = schema.parse(await req.json());
    const permission = body.purpose === "marketing" ? "marketing.manage" : "orders.manage";
    const { user } = await requirePermission(req, permission);
    const { data: existing } = await admin
      .from("whatsapp_messages")
      .select("id, provider_message_id, status")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (existing) return json({ message: existing, replayed: true });

    const [{ data: customer, error: customerError }, { data: template, error: templateError }] =
      await Promise.all([
        admin.from("profiles").select("id, phone, status").eq("id", body.customer_id).single(),
        admin.from("whatsapp_templates")
          .select("id, provider_template_id, name, language, status")
          .eq("id", body.template_id)
          .single(),
      ]);
    if (customerError || !customer?.phone) throw new Error("لا يوجد رقم جوال صالح للعميل");
    if (templateError || template?.status !== "approved") throw new Error("قالب واتساب غير معتمد");

    if (body.purpose === "marketing") {
      const { data: consent } = await admin
        .from("customer_marketing_consents")
        .select("consented")
        .eq("customer_id", body.customer_id)
        .eq("channel", "whatsapp")
        .maybeSingle();
      if (!consent?.consented) throw new Error("العميل غير موافق على الرسائل التسويقية");
    }

    const apiBase = requiredEnv("WHATSAPP_API_URL");
    const phoneNumberId = requiredEnv("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = requiredEnv("WHATSAPP_ACCESS_TOKEN");
    const messageId = crypto.randomUUID();
    await admin.from("whatsapp_messages").insert({
      id: messageId,
      customer_id: body.customer_id,
      order_id: body.order_id ?? null,
      campaign_id: body.campaign_id ?? null,
      template_id: body.template_id,
      destination: customer.phone,
      status: "queued",
      idempotency_key: key,
      created_by: user.id,
    });

    const components = body.parameters.length
      ? [{
        type: "body",
        parameters: body.parameters.map((text) => ({ type: "text", text })),
      }]
      : [];
    const response = await fetch(
      `${apiBase.replace(/\/$/, "")}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: customer.phone.replace(/[^\d+]/g, ""),
          type: "template",
          template: {
            name: template.provider_template_id ?? template.name,
            language: { code: template.language },
            components,
          },
        }),
      },
    );
    const providerResponse = await response.json().catch(() => ({})) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };
    const providerMessageId = providerResponse.messages?.[0]?.id;
    if (!response.ok || !providerMessageId) {
      await admin.from("whatsapp_messages").update({
        status: "failed",
        failure_reason: providerResponse.error?.message ?? `HTTP ${response.status}`,
        provider_response: providerResponse,
      }).eq("id", messageId);
      throw new Error("فشل مزود واتساب في قبول الرسالة");
    }

    await admin.from("whatsapp_messages").update({
      provider_message_id: providerMessageId,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_response: providerResponse,
    }).eq("id", messageId);
    return json({
      message_id: messageId,
      provider_message_id: providerMessageId,
      status: "sent",
      replayed: false,
    }, 201);
  } catch (error) {
    console.error("whatsapp-send", error);
    return publicError(error);
  }
});

