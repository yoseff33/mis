"use client";

import { Cable, CheckCircle2, Database, ShieldCheck } from "lucide-react";

export function ConnectionPage() {
  return (
    <main className="connection-page" dir="rtl">
      <section className="connection-card">
        <span className="connection-card__icon"><Cable size={30} /></span>
        <span className="eyebrow">خطوة ربط واحدة</span>
        <h1>اربط Supabase لبدء التشغيل الحقيقي</h1>
        <p>
          لم تُضبط مفاتيح قاعدة البيانات العامة بعد. لذلك لم ينشئ النظام
          بيانات بديلة ولم يحاكِ تسجيل الدخول أو الطلبات.
        </p>
        <div className="connection-code">
          <code>NEXT_PUBLIC_SUPABASE_URL</code>
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
        </div>
        <div className="connection-grid">
          <article><Database size={21} /><strong>بيانات فعلية</strong><span>الجداول والهجرات وRLS جاهزة للتطبيق.</span></article>
          <article><ShieldCheck size={21} /><strong>أسرار آمنة</strong><span>Service Role وأسرار الدفع تبقى في الخادم.</span></article>
          <article><CheckCircle2 size={21} /><strong>لا محاكاة</strong><span>الخدمة غير المفعّلة تظهر بوضوح ولا تدعي النجاح.</span></article>
        </div>
        <p className="connection-note">
          بعد إضافة المتغيرات وتطبيق ملفات Supabase ستظهر شاشة الإعداد الأول
          لإنشاء اسم الكوفي وأول فرع ومدير ومنتج حقيقي.
        </p>
      </section>
    </main>
  );
}

