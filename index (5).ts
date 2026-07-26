import { z } from "npm:zod@4";

export const uuid = z.string().uuid();

export const orderSchema = z.object({
  branch_id: uuid,
  parking_spot_id: uuid.nullish(),
  vehicle_id: uuid.nullish(),
  fulfillment_type: z.enum(["car", "window", "inside"]),
  payment_method: z.enum(["online", "cash"]),
  coupon_code: z.string().trim().max(64).optional(),
  reward_id: uuid.nullish(),
  customer_note: z.string().trim().max(1000).optional(),
  items: z.array(
    z.object({
      product_id: uuid,
      quantity: z.number().int().min(1).max(20),
      note: z.string().trim().max(500).optional(),
      option_value_ids: z.array(uuid).max(20).default([]),
    }),
  ).min(1).max(50),
});

export const setupSchema = z.object({
  coffee_name: z.string().trim().min(2).max(120),
  tax_rate: z.number().min(0).max(1),
  admin: z.object({
    email: z.string().email(),
    password: z.string().min(12).max(128),
    full_name: z.string().trim().min(2).max(120),
  }),
  branch: z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().regex(/^[a-z][a-z0-9-]{2,48}$/),
    address: z.string().trim().min(4).max(500),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    phone: z.string().trim().max(30).optional(),
    opening_hours: z.record(z.string(), z.unknown()).default({}),
  }),
  loyalty: z.object({
    name: z.string().trim().min(2).max(120).default("برنامج الولاء"),
    required_cups: z.number().int().min(1).max(100).default(6),
    minimum_spend: z.number().min(0).default(12),
    reward_max_value: z.number().min(0).default(25),
    reward_expire_days: z.number().int().min(1).max(3650).default(30),
    cups_expire_days: z.number().int().min(1).max(3650).nullish(),
  }),
  payments: z.object({
    methods: z.array(z.enum(["cash", "online"])).min(1),
    cash_enabled: z.boolean(),
    online_enabled: z.boolean(),
    provider: z.string().trim().max(50).optional(),
  }),
  whatsapp: z.object({
    enabled: z.boolean(),
    provider: z.string().trim().max(50).optional(),
  }),
  parking: z.object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(80),
    location_hint: z.string().trim().max(240).optional(),
  }),
  category: z.object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().regex(/^[a-z][a-z0-9-]{2,48}$/),
  }),
  product: z.object({
    name: z.string().trim().min(2).max(160),
    slug: z.string().regex(/^[a-z][a-z0-9-]{2,64}$/),
    description: z.string().trim().max(1000).optional(),
    price: z.number().positive().max(100000),
    sku: z.string().trim().max(64).optional(),
  }),
});

