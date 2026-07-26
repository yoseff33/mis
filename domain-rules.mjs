"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Check, Coffee, CreditCard, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";

const setupSchema = z.object({
  setup_token: z.string().min(12, "رمز التأسيس مطلوب"),
  coffee_name: z.string().min(2, "اسم الكوفي مطلوب"),
  tax_rate: z.coerce.number().min(0).max(1),
  admin_name: z.string().min(2, "اسم المدير مطلوب"),
  admin_email: z.string().email("البريد غير صحيح"),
  admin_password: z.string().min(12, "استخدم 12 حرفًا على الأقل"),
  branch_name: z.string().min(2, "اسم الفرع مطلوب"),
  branch_slug: z.string().regex(/^[a-z][a-z0-9-]{2,48}$/, "استخدم حروفًا إنجليزية صغيرة وشرطات"),
  branch_address: z.string().min(4, "العنوان مطلوب"),
  branch_phone: z.string().optional(),
  required_cups: z.coerce.number().int().min(1).max(100),
  minimum_spend: z.coerce.number().min(0),
  reward_max_value: z.coerce.number().min(0),
  online_payment: z.boolean(),
  whatsapp_enabled: z.boolean(),
  parking_code: z.string().min(1),
  parking_name: z.string().min(1),
  category_name: z.string().min(2),
  category_slug: z.string().regex(/^[a-z][a-z0-9-]{2,48}$/),
  product_name: z.string().min(2),
  product_slug: z.string().regex(/^[a-z][a-z0-9-]{2,64}$/),
  product_price: z.coerce.number().positive(),
  product_sku: z.string().optional(),
});

type SetupValues = z.infer<typeof setupSchema>;

const steps = [
  { title: "الهوية والمدير", icon: ShieldCheck },
  { title: "الفرع والضريبة", icon: Building2 },
  { title: "الولاء والدفع", icon: CreditCard },
  { title: "الموقف والمنيو", icon: Coffee },
];

export function SetupPage({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      setup_token: "",
      coffee_name: "",
      tax_rate: 0.15,
      admin_name: "",
      admin_email: "",
      admin_password: "",
      branch_name: "",
      branch_slug: "",
      branch_address: "",
      branch_phone: "",
      required_cups: 6,
      minimum_spend: 12,
      reward_max_value: 25,
      online_payment: false,
      whatsapp_enabled: false,
      parking_code: "A1",
      parking_name: "الموقف A1",
      category_name: "",
      category_slug: "",
      product_name: "",
      product_slug: "",
      product_price: 12,
      product_sku: "",
    },
  });

  async function submit(values: SetupValues) {
    setError(null);
    const supabase = getSupabase();
    const payload = {
      coffee_name: values.coffee_name,
      tax_rate: values.tax_rate,
      admin: {
        email: values.admin_email,
        password: values.admin_password,
        full_name: values.admin_name,
      },
      branch: {
        name: values.branch_name,
        slug: values.branch_slug,
        address: values.branch_address,
        phone: values.branch_phone || undefined,
        opening_hours: {},
      },
      loyalty: {
        name: `ولاء ${values.coffee_name}`,
        required_cups: values.required_cups,
        minimum_spend: values.minimum_spend,
        reward_max_value: values.reward_max_value,
        reward_expire_days: 30,
      },
      payments: {
        methods: values.online_payment ? ["cash", "online"] : ["cash"],
        cash_enabled: true,
        online_enabled: values.online_payment,
        provider: values.online_payment ? "moyasar" : undefined,
      },
      whatsapp: { enabled: values.whatsapp_enabled, provider: "cloud_api" },
      parking: { code: values.parking_code, name: values.parking_name },
      category: { name: values.category_name, slug: values.category_slug },
      product: {
        name: values.product_name,
        slug: values.product_slug,
        price: values.product_price,
        sku: values.product_sku || undefined,
      },
    };
    const { error: setupError } = await supabase.functions.invoke("initial-setup", {
      body: payload,
      headers: { "x-setup-token": values.setup_token },
    });
    if (setupError) {
      setError(setupError.message);
      return;
    }
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: values.admin_email,
      password: values.admin_password,
    });
    if (loginError) {
      setError("اكتمل الإعداد، لكن تعذر تسجيل الدخول تلقائيًا. ادخل من صفحة الموظفين.");
      return;
    }
    if (logo) {
      const extension = logo.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `branding/logo.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("brand-assets")
        .upload(path, logo, { upsert: true, contentType: logo.type });
      if (uploadError) {
        setError("اكتمل الإعداد، لكن تعذر رفع الشعار. يمكنك رفعه لاحقًا من الإعدادات.");
        return;
      }
      await supabase.from("system_settings").update({
        value: { name: values.coffee_name, currency: "SAR", locale: "ar-SA", logo_path: path },
      }).eq("key", "coffee_identity");
    }
    onComplete();
  }

  return (
    <main className="setup-page" dir="rtl">
      <header className="setup-hero">
        <span className="brand__mark"><Sparkles size={24} /></span>
        <div><span className="eyebrow">إعداد حقيقي لمرة واحدة</span><h1>خلّنا نجهّز كوفيك</h1><p>لن نضيف أي منتج أو فرع تجريبي. كل ما تدخله هنا سيُحفظ في Supabase.</p></div>
      </header>
      <div className="setup-layout">
        <ol className="setup-steps">
          {steps.map(({ title, icon: Icon }, index) => (
            <li key={title} className={index === step ? "active" : index < step ? "done" : ""}>
              <span>{index < step ? <Check size={17} /> : <Icon size={18} />}</span>
              <strong>{title}</strong>
            </li>
          ))}
        </ol>
        <form className="setup-card" onSubmit={form.handleSubmit(submit)}>
          {step === 0 && (
            <div className="form-grid">
              <Field label="رمز التأسيس السري" error={form.formState.errors.setup_token?.message}>
                <input type="password" {...form.register("setup_token")} />
              </Field>
              <Field label="اسم الكوفي" error={form.formState.errors.coffee_name?.message}>
                <input {...form.register("coffee_name")} />
              </Field>
              <Field label="الشعار" hint="PNG أو WebP أو JPEG، حتى 10MB">
                <input type="file" accept="image/png,image/webp,image/jpeg" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} />
              </Field>
              <Field label="اسم المدير العام" error={form.formState.errors.admin_name?.message}>
                <input {...form.register("admin_name")} />
              </Field>
              <Field label="بريد المدير" error={form.formState.errors.admin_email?.message}>
                <input dir="ltr" type="email" {...form.register("admin_email")} />
              </Field>
              <Field label="كلمة مرور المدير" error={form.formState.errors.admin_password?.message}>
                <input dir="ltr" type="password" {...form.register("admin_password")} />
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="form-grid">
              <Field label="اسم أول فرع" error={form.formState.errors.branch_name?.message}>
                <input {...form.register("branch_name")} />
              </Field>
              <Field label="معرّف الفرع بالرابط" error={form.formState.errors.branch_slug?.message}>
                <input dir="ltr" placeholder="riyadh-north" {...form.register("branch_slug")} />
              </Field>
              <Field label="عنوان الفرع" error={form.formState.errors.branch_address?.message}>
                <input {...form.register("branch_address")} />
              </Field>
              <Field label="رقم التواصل">
                <input dir="ltr" {...form.register("branch_phone")} />
              </Field>
              <Field label="نسبة الضريبة" hint="مثال: 0.15 تعني 15%">
                <input dir="ltr" type="number" step="0.01" {...form.register("tax_rate")} />
              </Field>
            </div>
          )}
          {step === 2 && (
            <div className="form-grid">
              <Field label="عدد الأكواب المطلوبة">
                <input dir="ltr" type="number" {...form.register("required_cups")} />
              </Field>
              <Field label="الحد الأدنى للفاتورة">
                <input dir="ltr" type="number" step="0.01" {...form.register("minimum_spend")} />
              </Field>
              <Field label="أعلى قيمة للمشروب المجاني">
                <input dir="ltr" type="number" step="0.01" {...form.register("reward_max_value")} />
              </Field>
              <label className="toggle-field"><input type="checkbox" {...form.register("online_payment")} /><span>تفعيل الدفع الإلكتروني بعد إضافة مفاتيح البوابة</span></label>
              <label className="toggle-field"><input type="checkbox" {...form.register("whatsapp_enabled")} /><span>تفعيل واتساب بعد إضافة مفاتيح الخدمة</span></label>
            </div>
          )}
          {step === 3 && (
            <div className="form-grid">
              <Field label="رمز أول موقف"><input dir="ltr" {...form.register("parking_code")} /></Field>
              <Field label="اسم الموقف"><input {...form.register("parking_name")} /></Field>
              <Field label="اسم أول تصنيف"><input {...form.register("category_name")} /></Field>
              <Field label="معرّف التصنيف"><input dir="ltr" {...form.register("category_slug")} /></Field>
              <Field label="اسم أول منتج"><input {...form.register("product_name")} /></Field>
              <Field label="معرّف المنتج"><input dir="ltr" {...form.register("product_slug")} /></Field>
              <Field label="سعر المنتج"><input dir="ltr" type="number" step="0.01" {...form.register("product_price")} /></Field>
              <Field label="SKU اختياري"><input dir="ltr" {...form.register("product_sku")} /></Field>
            </div>
          )}
          {error && <p className="form-message form-message--error" role="alert">{error}</p>}
          <div className="setup-actions">
            {step > 0 && <Button type="button" variant="ghost" onClick={() => setStep((value) => value - 1)}>السابق</Button>}
            {step < steps.length - 1 ? (
              <Button type="button" onClick={async () => {
                const fieldsByStep: Array<Array<keyof SetupValues>> = [
                  ["setup_token","coffee_name","admin_name","admin_email","admin_password"],
                  ["branch_name","branch_slug","branch_address","tax_rate"],
                  ["required_cups","minimum_spend","reward_max_value"],
                  ["parking_code","parking_name","category_name","category_slug","product_name","product_slug","product_price"],
                ];
                if (await form.trigger(fieldsByStep[step])) setStep((value) => value + 1);
              }}>التالي</Button>
            ) : (
              <Button type="submit" busy={form.formState.isSubmitting}><MapPin size={18} /> أنشئ النظام</Button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

