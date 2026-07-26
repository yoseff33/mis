export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-setup-token, x-webhook-signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export function options(req: Request) {
  return req.method === "OPTIONS"
    ? new Response(null, { status: 204, headers: corsHeaders })
    : null;
}

export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
  const safe =
    message.includes("ليس لديك") ||
    message.includes("غير موجود") ||
    message.includes("غير صالح") ||
    message.includes("غير متاح") ||
    message.includes("يجب ") ||
    message.includes("تعذر ") ||
    message.includes("تم بلوغ") ||
    message.includes("لم يتم تفعيل")
      ? message
      : "تعذر تنفيذ العملية. حاول مرة أخرى أو تواصل مع الإدارة.";
  return json({ error: safe }, safe.includes("صلاحية") ? 403 : 400);
}

export function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`لم يتم تفعيل الخدمة: المتغير ${name} غير مضبوط`);
  return value;
}

export function idempotencyKey(req: Request) {
  const value = req.headers.get("idempotency-key");
  if (!value || value.length < 12 || value.length > 160) {
    throw new Error("مفتاح منع تكرار العملية غير صالح");
  }
  return value;
}

