import { z } from "npm:zod@4";
import { idempotencyKey, json, options, publicError } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { createPaymentAtProvider } from "../_shared/payments.ts";
import { uuid } from "../_shared/validators.ts";

const schema = z.object({
  order_id: uuid,
  source_token: z.string().min(12).max(1000),
  callback_url: z.string().url(),
});

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  const admin = adminClient();
  let localPaymentId: string | null = null;
  try {
    const key = idempotencyKey(req);
    const body = schema.parse(await req.json());
    const { user } = await requireUser(req);
    const { data: existing } = await admin
      .from("payments")
      .select("id, provider_payment_id, status, provider_response")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (existing) {
      return json({
        payment_id: existing.id,
        provider_payment_id: existing.provider_payment_id,
        status: existing.status,
        transaction_url:
          (existing.provider_response as Record<string, unknown> | null)?.transaction_url ?? null,
        replayed: true,
      });
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, order_number, customer_id, branch_id, total, currency, status, payment_method")
      .eq("id", body.order_id)
      .eq("customer_id", user.id)
      .single();
    if (orderError || !order) throw new Error("الطلب غير موجود");
    if (order.payment_method !== "online" || order.status !== "pending_payment") {
      throw new Error("الطلب غير متاح للدفع الإلكتروني");
    }
    const { data: branchSettings } = await admin
      .from("branch_settings")
      .select("online_payment_enabled")
      .eq("branch_id", order.branch_id)
      .single();
    if (!branchSettings?.online_payment_enabled) {
      throw new Error("لم يتم تفعيل الدفع الإلكتروني لهذا الفرع");
    }

    localPaymentId = crypto.randomUUID();
    const { error: insertError } = await admin.from("payments").insert({
      id: localPaymentId,
      order_id: order.id,
      provider: Deno.env.get("PAYMENT_PROVIDER") ?? "moyasar",
      amount: order.total,
      currency: order.currency,
      status: "pending",
      idempotency_key: key,
    });
    if (insertError) throw new Error(insertError.message);

    const provider = await createPaymentAtProvider({
      givenId: localPaymentId,
      amountMinor: Math.round(Number(order.total) * 100),
      currency: order.currency,
      orderNumber: order.order_number,
      orderId: order.id,
      callbackUrl: body.callback_url,
      sourceToken: body.source_token,
    });
    await admin.from("payments").update({
      provider_payment_id: provider.id,
      status: provider.status === "paid" ? "pending" : provider.status === "failed" ? "failed" : "pending",
      provider_response: {
        transaction_url: provider.transactionUrl,
        provider_status: provider.status,
      },
    }).eq("id", localPaymentId);

    return json({
      payment_id: localPaymentId,
      provider_payment_id: provider.id,
      status: provider.status,
      transaction_url: provider.transactionUrl,
      replayed: false,
    }, 201);
  } catch (error) {
    if (localPaymentId) {
      await admin.from("payments").update({ status: "failed" }).eq("id", localPaymentId);
    }
    console.error("payment-create", error);
    return publicError(error);
  }
});

