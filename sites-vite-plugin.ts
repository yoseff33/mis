import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionOrder,
  designIsSafe,
  loyaltyAfterCup,
  loyaltyCupAward,
  rectanglesIntersect,
} from "../lib/domain-rules.mjs";

test("فاتورة أقل من 12 لا تمنح كوبًا", () => {
  assert.equal(loyaltyCupAward({
    eligibleSpend: 11.99,
    delivered: true,
    paidOrCash: true,
    alreadyAwarded: false,
  }), 0);
});

test("فاتورة 12 أو أكثر تمنح كوبًا واحدًا فقط", () => {
  assert.equal(loyaltyCupAward({
    eligibleSpend: 12,
    delivered: true,
    paidOrCash: true,
    alreadyAwarded: false,
  }), 1);
  assert.equal(loyaltyCupAward({
    eligibleSpend: 1200,
    delivered: true,
    paidOrCash: true,
    alreadyAwarded: false,
  }), 1);
});

test("لا يُحتسب الطلب مرتين ولا قبل التسليم أو الدفع", () => {
  assert.equal(loyaltyCupAward({
    eligibleSpend: 50,
    delivered: true,
    paidOrCash: true,
    alreadyAwarded: true,
  }), 0);
  assert.equal(loyaltyCupAward({
    eligibleSpend: 50,
    delivered: false,
    paidOrCash: true,
    alreadyAwarded: false,
  }), 0);
  assert.equal(loyaltyCupAward({
    eligibleSpend: 50,
    delivered: true,
    paidOrCash: false,
    alreadyAwarded: false,
  }), 0);
});

test("الكوب السادس ينشئ مكافأة ويعيد الرصيد للصفر", () => {
  assert.deepEqual(loyaltyAfterCup({ balance: 5, requiredCups: 6 }), {
    balance: 0,
    rewardCreated: true,
  });
  assert.deepEqual(loyaltyAfterCup({ balance: 4, requiredCups: 6 }), {
    balance: 5,
    rewardCreated: false,
  });
});

test("انتقالات الطلب تمنع التحويلات العشوائية", () => {
  assert.equal(canTransitionOrder("confirmed", "preparing"), true);
  assert.equal(canTransitionOrder("preparing", "ready"), true);
  assert.equal(canTransitionOrder("cancelled", "ready"), false);
  assert.equal(canTransitionOrder("pending_payment", "delivered"), false);
});

test("كشف التصادم يحمي QR وباقي المناطق", () => {
  const qr = { x: 468, y: 21, width: 216, height: 176 };
  assert.equal(rectanglesIntersect(
    { x: 500, y: 50, width: 80, height: 80 },
    qr,
  ), true);
  assert.equal(rectanglesIntersect(
    { x: 210, y: 130, width: 90, height: 90 },
    qr,
  ), false);
  assert.equal(designIsSafe(
    [{ x: 210, y: 130, width: 90, height: 90 }],
    [qr],
  ), true);
  assert.equal(designIsSafe(
    [{ x: 500, y: 50, width: 80, height: 80 }],
    [qr],
  ), false);
});

test("عدد عناصر التصميم لا يتجاوز الحد", () => {
  const elements = Array.from({ length: 31 }, (_, index) => ({
    x: index,
    y: 100,
    width: 1,
    height: 1,
  }));
  assert.equal(designIsSafe(elements, [], 30), false);
});

