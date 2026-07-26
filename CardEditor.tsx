"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Mail, Phone, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button, Field, PageHeader } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";

const phoneSchema = z.object({
  phone: z.string().regex(/^\+9665\d{8}$/, "اكتب الرقم بصيغة +9665XXXXXXXX"),
  otp: z.string().regex(/^\d{4,8}$/, "رمز التحقق غير مكتمل").optional(),
});

const staffSchema = z.object({
  email: z.string().email("البريد غير صحيح"),
  password: z.string().min(8, "كلمة المرور غير مكتملة"),
});

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"customer" | "staff">("customer");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const customer = useForm<z.infer<typeof phoneSchema>>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "+9665", otp: "" },
  });
  const staff = useForm<z.infer<typeof staffSchema>>({
    resolver: zodResolver(staffSchema),
    defaultValues: { email: "", password: "" },
  });

  async function sendOtp(values: z.infer<typeof phoneSchema>) {
    setMessage(null);
    const { error } = await getSupabase().auth.signInWithOtp({
      phone: values.phone,
      options: { shouldCreateUser: true },
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setOtpSent(true);
    setMessage("أرسلنا رمز التحقق إلى جوالك.");
  }

  async function verifyOtp(values: z.infer<typeof phoneSchema>) {
    setMessage(null);
    const parsed = phoneSchema.extend({ otp: z.string().min(4) }).parse(values);
    const { error } = await getSupabase().auth.verifyOtp({
      phone: parsed.phone,
      token: parsed.otp,
      type: "sms",
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    navigate("/menu");
  }

  async function staffLogin(values: z.infer<typeof staffSchema>) {
    setMessage(null);
    const { error } = await getSupabase().auth.signInWithPassword(values);
    if (error) {
      setMessage("تعذر تسجيل الدخول. تحقق من البيانات وحالة الحساب.");
      return;
    }
    navigate("/admin");
  }

  return (
    <div className="auth-page">
      <PageHeader
        eyebrow="حساب آمن"
        title="أهلًا برجعتك"
        description="دخول العملاء برمز جوال حقيقي، والموظفين بحساباتهم الإدارية."
        backTo="/"
      />
      <section className="auth-card">
        <div className="segmented">
          <button className={mode === "customer" ? "active" : ""} onClick={() => setMode("customer")}>
            <Phone size={18} /> عميل
          </button>
          <button className={mode === "staff" ? "active" : ""} onClick={() => setMode("staff")}>
            <ShieldCheck size={18} /> موظف
          </button>
        </div>

        {mode === "customer" ? (
          <form onSubmit={customer.handleSubmit(otpSent ? verifyOtp : sendOtp)} className="form-stack">
            <Field label="رقم الجوال" error={customer.formState.errors.phone?.message}>
              <input inputMode="tel" dir="ltr" {...customer.register("phone")} disabled={otpSent} />
            </Field>
            {otpSent && (
              <Field label="رمز التحقق" error={customer.formState.errors.otp?.message}>
                <input inputMode="numeric" dir="ltr" autoComplete="one-time-code" {...customer.register("otp")} />
              </Field>
            )}
            {message && <p className="form-message" role="status">{message}</p>}
            <Button busy={customer.formState.isSubmitting} type="submit">
              {otpSent ? <><KeyRound size={18} /> تحقق وادخل</> : <><Phone size={18} /> أرسل الرمز</>}
            </Button>
            {otpSent && <Button type="button" variant="ghost" onClick={() => setOtpSent(false)}>تغيير الرقم</Button>}
          </form>
        ) : (
          <form onSubmit={staff.handleSubmit(staffLogin)} className="form-stack">
            <Field label="البريد الإداري" error={staff.formState.errors.email?.message}>
              <input type="email" dir="ltr" autoComplete="username" {...staff.register("email")} />
            </Field>
            <Field label="كلمة المرور" error={staff.formState.errors.password?.message}>
              <input type="password" dir="ltr" autoComplete="current-password" {...staff.register("password")} />
            </Field>
            {message && <p className="form-message form-message--error" role="alert">{message}</p>}
            <Button busy={staff.formState.isSubmitting} type="submit"><Mail size={18} /> دخول الموظف</Button>
          </form>
        )}
      </section>
    </div>
  );
}

