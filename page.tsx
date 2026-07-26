import { json, requiredEnv } from "../_shared/http.ts";
import { verifyHmacSha256 } from "../_shared/crypto.ts";
import { adminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const valid = url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === requiredEnv("WHATSAPP_VERIFY_TOKEN");
    return valid
      ? new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 })
      : json({ error: "تعذر التحقق من Webhook" }, 403);
  }
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);

  const rawBody = await req.text();
  const valid = await verifyHmacSha256(
    rawBody,
    req.headers.get("x-hub-signature-256"),
    requiredEnv("WHATSAPP_WEBHOOK_SECRET"),
  );
  if (!valid) return json({ error: "توقيع Webhook غير صحيح" }, 401);

  try {
    const payload = JSON.parse(rawBody) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id: string;
              status: "sent" | "delivered" | "read" | "failed";
              timestamp?: string;
              errors?: Array<{ title?: string }>;
            }>;
          };
        }>;
      }>;
    };
    const statuses = payload.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) => change.value?.statuses ?? []) ?? []
    ) ?? [];
    const admin = adminClient();
    for (const status of statuses) {
      const update: Record<string, unknown> = {
        status: status.status,
        failure_reason: status.errors?.map((error) => error.title).filter(Boolean).join("، ") ?? null,
      };
      const timestamp = status.timestamp
        ? new Date(Number(status.timestamp) * 1000).toISOString()
        : new Date().toISOString();
      if (status.status === "delivered") update.delivered_at = timestamp;
      if (status.status === "read") update.read_at = timestamp;
      if (status.status === "sent") update.sent_at = timestamp;
      await admin.from("whatsapp_messages").update(update).eq("provider_message_id", status.id);
    }
    return json({ received: true, statuses: statuses.length });
  } catch (error) {
    console.error("whatsapp-webhook", error);
    return json({ error: "تعذر معالجة Webhook" }, 400);
  }
});

