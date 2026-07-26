export const allowedOrderTransitions = Object.freeze({
  pending_payment: ["paid", "payment_failed", "cancelled"],
  payment_failed: ["pending_payment", "cancelled"],
  paid: ["confirmed"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered"],
  delivered: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
});

export function canTransitionOrder(from, to) {
  return allowedOrderTransitions[from]?.includes(to) ?? false;
}

export function loyaltyCupAward({
  eligibleSpend,
  minimumSpend = 12,
  delivered,
  paidOrCash,
  alreadyAwarded,
}) {
  if (!delivered || !paidOrCash || alreadyAwarded || eligibleSpend <= 0) return 0;
  return eligibleSpend >= minimumSpend ? 1 : 0;
}

export function loyaltyAfterCup({
  balance,
  requiredCups = 6,
}) {
  const next = balance + 1;
  return next >= requiredCups
    ? { balance: next - requiredCups, rewardCreated: true }
    : { balance: next, rewardCreated: false };
}

export function rectanglesIntersect(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

export function designIsSafe(elements, protectedZones, maxElements = 30) {
  return elements.length <= maxElements &&
    elements.every((element) =>
      element.x >= 0 &&
      element.y >= 0 &&
      element.width > 0 &&
      element.height > 0 &&
      !protectedZones.some((zone) => rectanglesIntersect(element, zone))
    );
}

