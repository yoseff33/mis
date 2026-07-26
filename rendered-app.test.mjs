import { json, publicError, requiredEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/supabase.ts";
import { verifyHmacSha256 } from "../_shared/crypto.ts";

function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  const admin = adminClient();
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody) as {
      id?: string;
      type?: string;
      secret_token?: string;
      data?: {
        id?: string;
        given_id?: string;
        status?: string;
        amount?: number;
        currency?: string;
      };
    };
    const provider = Deno.env.get("PAYMENT_PROVIDER") ?? "moyasar";
    const secret = requiredEnv("PAYMENT_WEBHOOK_SECRET");
    const signatureValid = provider === "moyasar"
      ? safeEqual(payload.secret_token ?? "", secret)
      : await verifyHmacSha256(rawBody, req.headers.get("x-webhook-signature"), secret);
    if (!signatureValid) return json({ error: "توقيع Webhook غير صحيح" }, 401);

    const providerEventId = payload.id ??
      `${payload.type}:${payload.data?.id}:${payload.data?.status}`;
    const { data: existing } = await admin
      .from("payment_events")
      .select("id, processed_at")
      .eq("provider", provider)
      .eq("provider_event_id", providerEventId)
      .maybeSingle();
    if (existing?.processed_at) return json({ received: true, replayed: true });

    const paymentId = existing?.id ? null : crypto.randomUUID();
    if (!existing) {
      const { error: eventInsertError } = await admin.from("payment_events").insert({
        id: paymentId,
        provider,
        provider_event_id: providerEventId,
        event_type: payload.type ?? "unknown",
        signature_valid: true,
        payload,
      });
      if (eventInsertError) throw new Error(eventInsertError.message);
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id, order_id, amount, currency, status")
      .or(`provider_payment_id.eq.${payload.data?.id},id.eq.${payload.data?.given_id}`)
      .maybeSingle();
    if (paymentError || !payment) throw new Error("الدفعة المرتبطة بالحدث غير موجودة");
    if (
      payload.data?.amount != null &&
      Math.round(Number(payment.amount) * 100) !== Number(payload.data.amount)
    ) throw new Error("قيمة Webhook لا تطابق قيمة الطلب");
    if (payload.data?.currency && payment.currency !== payload.data.currency) {
      throw new Error("عملة Webhook لا تطابق عملة الطلب");
    }

    const paid = payload.type === "payment_paid" || payload.data?.status === "paid";
    const failed = payload.type === "payment_failed" || payload.data?.status === "failed";
    if (paid) {
      await admin.from("payments").update({
        status: "paid",
        paid_at: new Date().toISOString(),
        provider_response: payload.data,
      }).eq("id", payment.id);
      const { data: order } = await admin.from("orders").select("status").eq("id", payment.order_id).single();
      if (order?.status === "pending_payment" || order?.status === "paid") {
        await admin.from("orders").update({ status: "confirmed" }).eq("id", payment.order_id);
        await admin.from("order_status_history").insert([
          { order_id: payment.order_id, from_status: order.status, to_status: "paid", metadata: { webhook: providerEventId } },
          { order_id: payment.order_id, from_status: "paid", to_status: "confirmed", metadata: { webhook: providerEventId } },
        ]);
      }
    } else if (failed) {
      await admin.from("payments").update({
        status: "failed",
        provider_response: payload.data,
      }).eq("id", payment.id);
      await admin.from("orders").update({ status: "payment_failed" }).eq("id", payment.order_id).eq("status", "pending_payment");
      await admin.from("order_status_history").insert({
        order_id: payment.order_id,
        from_status: "pending_payment",
        to_status: "payment_failed",
        metadata: { webhook: providerEventId },
      });
    }

    await admin.from("payment_events").update({
      payment_id: payment.id,
      processed_at: new Date().toISOString(),
    }).eq("provider", provider).eq("provider_event_id", providerEventId);
    return json({ received: true, replayed: false });
  } catch (error) {
    console.error("payment-webhook", error);
    return publicError(error);
  }
});
