import { z } from "npm:zod@4";
import * as XLSX from "npm:xlsx@0.18.5";
import { json, options, publicError, requiredEnv } from "../_shared/http.ts";
import { adminClient, requirePermission } from "../_shared/supabase.ts";
import { uuid } from "../_shared/validators.ts";

const reports = {
  sales: { table: "orders", columns: "order_number,branch_id,status,total,tax_total,discount_total,payment_method,created_at", branch: true },
  orders: { table: "orders", columns: "order_number,branch_id,status,fulfillment_type,subtotal,discount_total,tax_total,total,created_at", branch: true },
  payments: { table: "payments", columns: "id,order_id,provider,amount,currency,status,paid_at,created_at", branch: false },
  refunds: { table: "refunds", columns: "id,order_id,amount,reason,status,created_at", branch: false },
  products: { table: "products", columns: "sku,name_ar,base_price,status,created_at", branch: false },
  customers: { table: "profiles", columns: "member_number,full_name,phone,status,created_at", branch: false },
  loyalty: { table: "loyalty_transactions", columns: "customer_id,branch_id,order_id,type,cups_delta,balance_before,balance_after,reason,created_at", branch: true },
  rewards: { table: "loyalty_rewards", columns: "customer_id,max_value,status,expires_at,redeemed_at,created_at", branch: false },
  branches: { table: "branches", columns: "name_ar,address,status,accepting_orders,expected_prep_minutes,created_at", branch: false },
  campaigns: { table: "campaigns", columns: "name,branch_id,status,target_count,success_count,failed_count,redemption_count,attributed_revenue,created_at", branch: true },
  coupons: { table: "coupons", columns: "code,name_ar,discount_type,discount_value,status,starts_at,ends_at,created_at", branch: true },
  stickers: { table: "stickers", columns: "name_ar,status,is_global,is_seasonal,requires_unlock,created_at", branch: false },
  assets: { table: "customer_assets", columns: "customer_id,mime_type,byte_size,processing_status,moderation_status,created_at", branch: false },
} as const;

const schema = z.object({
  report: z.enum(Object.keys(reports) as [keyof typeof reports, ...(keyof typeof reports)[]]),
  format: z.enum(["csv", "xlsx", "pdf"]),
  branch_id: uuid.nullish(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "\uFEFF";
  const keys = Object.keys(rows[0]);
  return `\uFEFF${keys.map(csvCell).join(",")}\n${
    rows.map((row) => keys.map((key) => csvCell(row[key])).join(",")).join("\n")
  }`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function renderPdf(rows: Record<string, unknown>[], title: string) {
  const keys = rows[0] ? Object.keys(rows[0]) : [];
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
  <style>body{font-family:Arial,sans-serif;color:#1d1b18;padding:32px}h1{color:#6b3f22}
  table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ddd;padding:6px;text-align:right}
  th{background:#f2ece5}tr:nth-child(even){background:#faf8f5}</style></head>
  <body><h1>${escapeHtml(title)}</h1><table><thead><tr>${
    keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")
  }</tr></thead><tbody>${
    rows.map((row) => `<tr>${
      keys.map((key) => `<td>${escapeHtml(typeof row[key] === "object" ? JSON.stringify(row[key]) : row[key])}</td>`).join("")
    }</tr>`).join("")
  }</tbody></table></body></html>`;
  const response = await fetch(requiredEnv("PDF_RENDER_API_URL"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("PDF_RENDER_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ html, page_size: "A4", landscape: true }),
  });
  if (!response.ok) throw new Error("تعذر إنشاء تقرير PDF لدى خدمة التحويل");
  return new Uint8Array(await response.arrayBuffer());
}

Deno.serve(async (req) => {
  const preflight = options(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json({ error: "الطريقة غير مسموحة" }, 405);
  try {
    const body = schema.parse(await req.json());
    const { user } = await requirePermission(req, "reports.export", body.branch_id ?? null);
    const config = reports[body.report];
    const admin = adminClient();
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      let query = admin.from(config.table).select(config.columns).range(from, from + 999).order("created_at");
      if (config.branch && body.branch_id) query = query.eq("branch_id", body.branch_id);
      if (body.from) query = query.gte("created_at", body.from);
      if (body.to) query = query.lte("created_at", body.to);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      rows.push(...(data as unknown as Record<string, unknown>[]));
      if (!data || data.length < 1000) break;
    }

    let bytes: Uint8Array;
    let mime: string;
    if (body.format === "csv") {
      bytes = new TextEncoder().encode(toCsv(rows));
      mime = "text/csv";
    } else if (body.format === "xlsx") {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Report");
      bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
      mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      bytes = await renderPdf(rows, `تقرير ${body.report}`);
      mime = "application/pdf";
    }
    const path = `${user.id}/${body.report}-${new Date().toISOString().replaceAll(":", "-")}.${body.format}`;
    const { error: uploadError } = await admin.storage
      .from("exports")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data: media, error: mediaError } = await admin.from("media_files").insert({
      owner_id: user.id,
      bucket: "exports",
      object_path: path,
      mime_type: mime,
      byte_size: bytes.byteLength,
      visibility: "private",
      created_by: user.id,
    }).select("id").single();
    if (mediaError) throw new Error(mediaError.message);
    return json({ export_id: media.id, path, rows: rows.length }, 201);
  } catch (error) {
    console.error("report-export", error);
    return publicError(error);
  }
});

