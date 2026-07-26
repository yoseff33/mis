import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionsSql = await readFile(
  new URL("../supabase/migrations/202607260002_secure_functions.sql", import.meta.url),
  "utf8",
);
const schemaSql = await readFile(
  new URL("../supabase/migrations/202607260001_core_schema.sql", import.meta.url),
  "utf8",
);
const rlsSql = await readFile(
  new URL("../supabase/migrations/202607260003_rls_storage_realtime.sql", import.meta.url),
  "utf8",
);

test("رقم العضوية سبعة أرقام عشوائية مع قيد فريد", () => {
  assert.match(schemaSql, /member_number char\(7\) unique/i);
  assert.match(functionsSql, /1000000 \+ floor\(random\(\) \* 9000000\)/i);
  assert.doesNotMatch(functionsSql, /phone.*member_number/i);
});

test("منع منح كوبين للطلب نفسه موجود في قاعدة البيانات", () => {
  assert.match(schemaSql, /loyalty_one_earned_cup_per_order_idx/i);
  assert.match(functionsSql, /already_processed/i);
  assert.match(functionsSql, /minimum_spend/i);
});

test("الدفع والطلبات يملكان مفاتيح idempotency فريدة", () => {
  assert.match(schemaSql, /idempotency_key text not null unique/gi);
  assert.match(functionsSql, /create_order_atomic/i);
});

test("RLS مفعل والسياسات تمنع البيانات العابرة للعملاء", () => {
  assert.match(rlsSql, /alter table public\.%I enable row level security/i);
  assert.match(rlsSql, /customer_id = auth\.uid\(\)/i);
  assert.match(rlsSql, /bucket_id = 'customer-assets'/i);
  assert.match(rlsSql, /foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
});

test("سجل التدقيق غير قابل للتعديل أو الحذف", () => {
  assert.match(rlsSql, /audit_logs_immutable/i);
  assert.match(rlsSql, /before update or delete/i);
});

