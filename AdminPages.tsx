"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Car,
  Coffee,
  Gift,
  ImagePlus,
  Palette,
  QrCode,
  Save,
  ShieldCheck,
  Stamp,
  TicketPercent,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/Providers";
import { Button, EmptyState, ErrorState, Field, LoadingPage, PageHeader, StatusPill } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";

function SignInRequired() {
  return <EmptyState title="هذه الصفحة خاصة بحسابك" description="سجّل الدخول لعرض بياناتك المحمية." action={<Link className="button button--primary" to="/login">تسجيل الدخول</Link>} />;
}

export function ProfilePage() {
  const auth = useAuth();
  const [name, setName] = useState(auth.profile?.full_name ?? "");
  const [branchId, setBranchId] = useState(auth.profile?.preferred_branch_id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const branches = useQuery({
    queryKey: ["branches-profile"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("branches").select("id,name_ar").eq("status", "active").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().from("profiles").update({
        full_name: name,
        preferred_branch_id: branchId || null,
      }).eq("id", auth.session!.user.id);
      if (error) throw error;
    },
    onSuccess: async () => { await auth.refreshProfile(); setMessage("تم حفظ ملفك."); },
    onError: () => setMessage("تعذر حفظ الملف الشخصي."),
  });
  if (auth.loading) return <LoadingPage />;
  if (!auth.session) return <SignInRequired />;
  return (
    <div><PageHeader eyebrow="حسابك" title="الملف الشخصي" description="بياناتك محمية ولا تظهر لعميل آخر." />
      <div className="profile-layout">
        <aside className="profile-card"><span><UserRound size={32} /></span><h2>{auth.profile?.full_name || "عميل مِرسى"}</h2><p>رقم العضوية</p><strong dir="ltr">{auth.profile?.member_number}</strong><StatusPill tone="success">حساب فعّال</StatusPill></aside>
        <section className="settings-card form-stack">
          <Field label="الاسم"><input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="رقم الجوال" hint="يُعدل عبر إجراءات التحقق في Supabase Auth"><input dir="ltr" value={auth.profile?.phone ?? ""} disabled /></Field>
          <Field label="الفرع المفضل"><select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">بدون تحديد</option>{branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_ar}</option>)}</select></Field>
          {message && <p className="form-message">{message}</p>}
          <Button busy={save.isPending} onClick={() => save.mutate()}><Save size={18} /> حفظ التغييرات</Button>
          <Button variant="ghost" onClick={() => void getSupabase().auth.signOut({ scope: "global" })}>تسجيل الخروج من جميع الأجهزة</Button>
        </section>
      </div>
    </div>
  );
}

export function VehiclesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ vehicle_type: "sedan", make: "", model: "", color: "", plate_hint: "" });
  const vehicles = useQuery({
    queryKey: ["vehicles", session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("customer_vehicles").select("*").is("deleted_at", null).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().from("customer_vehicles").insert({ ...form, customer_id: session!.user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ vehicle_type: "sedan", make: "", model: "", color: "", plate_hint: "" });
      void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
  async function remove(id: string) {
    await getSupabase().from("customer_vehicles").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  }
  if (!session) return <SignInRequired />;
  return (
    <div><PageHeader eyebrow="للتسليم الأسرع" title="سياراتي" description="احفظ أكثر من سيارة واخترها عند الطلب." />
      <div className="two-column">
        <section className="card-list">{vehicles.data?.map((vehicle) => <article key={vehicle.id}><span><Car size={22} /></span><div><h3>{vehicle.make} {vehicle.model}</h3><p>{vehicle.color} {vehicle.plate_hint && `• ${vehicle.plate_hint}`}</p></div><button onClick={() => void remove(vehicle.id)} aria-label="حذف السيارة"><Trash2 size={18} /></button></article>)}{!vehicles.isLoading && !vehicles.data?.length && <EmptyState title="لا توجد سيارة محفوظة" description="أضف سيارتك لتسليم الطلب بشكل أدق." />}</section>
        <form className="settings-card form-stack" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}>
          <h2>إضافة سيارة</h2>
          <Field label="الشركة"><input required value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} /></Field>
          <Field label="الموديل"><input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></Field>
          <Field label="اللون"><input required value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></Field>
          <Field label="آخر أرقام اللوحة"><input dir="ltr" value={form.plate_hint} onChange={(event) => setForm({ ...form, plate_hint: event.target.value })} /></Field>
          <Button busy={add.isPending} type="submit"><Car size={18} /> حفظ السيارة</Button>
        </form>
      </div>
    </div>
  );
}

export function LoyaltyPage() {
  const { session, profile } = useAuth();
  const [qrToken, setQrToken] = useState<string | null>(null);
  const data = useQuery({
    queryKey: ["loyalty", session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const supabase = getSupabase();
      const [{ data: accounts, error }, { data: rewards }, { data: history }] = await Promise.all([
        supabase.from("loyalty_accounts").select("*,loyalty_programs(required_cups,minimum_spend,reward_max_value,name_ar)").limit(1).maybeSingle(),
        supabase.from("loyalty_rewards").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("loyalty_transactions").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      if (error) throw error;
      return { account: accounts, rewards: rewards ?? [], history: history ?? [] };
    },
  });
  const rotateQr = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().functions.invoke("customer-qr", { body: { action: "rotate" } });
      if (error) throw error;
      return data.token as string;
    },
    onSuccess: setQrToken,
  });
  if (!session) return <SignInRequired />;
  if (data.isLoading) return <LoadingPage label="نجهز بطاقتك…" />;
  const account = data.data?.account;
  const required = account?.loyalty_programs?.required_cups ?? 6;
  const balance = account?.cup_balance ?? 0;
  return (
    <div><PageHeader eyebrow="الكوب السابع علينا" title="بطاقة الولاء" description="كل حركة مرتبطة بطلب مكتمل ومسجلة في سجل غير قابل للحذف." action={<Link className="button button--secondary" to="/card-editor"><Palette size={18} /> زيّن بطاقتك</Link>} />
      <section className="loyalty-card">
        <div className="loyalty-card__header"><div><small>عضو مِرسى</small><h2>{profile?.full_name || "عميلنا"}</h2><strong dir="ltr">#{profile?.member_number}</strong></div><span><Stamp size={30} /></span></div>
        <div className="cups">{Array.from({ length: required }, (_, index) => <span className={index < balance ? "filled" : ""} key={index}><Coffee size={24} /></span>)}</div>
        <div className="loyalty-progress"><div style={{ width: `${Math.min(100, balance / required * 100)}%` }} /><span>{balance} من {required} أكواب</span></div>
        <div className="loyalty-card__footer"><div>{qrToken ? <QRCodeSVG value={qrToken} size={92} level="M" /> : <QrCode size={58} />}</div><Button variant="secondary" busy={rotateQr.isPending} onClick={() => rotateQr.mutate()}>{qrToken ? "تدوير الرمز" : "إظهار QR الآمن"}</Button></div>
      </section>
      <div className="loyalty-columns">
        <section><h2>المكافآت</h2>{data.data?.rewards.length ? data.data.rewards.map((reward) => <article className="reward-row" key={reward.id}><Gift size={21} /><div><strong>مشروب حتى {Number(reward.max_value).toFixed(2)} ر.س</strong><span>{reward.status === "available" ? "متاحة" : reward.status}</span></div></article>) : <EmptyState title="لا توجد مكافأة متاحة" description={`باقي ${Math.max(required - balance, 0)} أكواب للمكافأة القادمة.`} />}</section>
        <section><h2>سجل الأكواب</h2>{data.data?.history.length ? data.data.history.map((entry) => <article className="history-row" key={entry.id}><span className={Number(entry.cups_delta) > 0 ? "positive" : "negative"}>{Number(entry.cups_delta) > 0 ? "+" : ""}{entry.cups_delta}</span><div><strong>{entry.reason || entry.type}</strong><small>{new Date(entry.created_at).toLocaleString("ar-SA")}</small></div><em>{entry.balance_after} كوب</em></article>) : <EmptyState title="لا توجد حركات بعد" description="يضاف أول كوب بعد اكتمال طلب مؤهل." />}</section>
      </div>
    </div>
  );
}

export function RewardsPage() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["rewards"],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("loyalty_rewards").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (!session) return <SignInRequired />;
  return <div><PageHeader eyebrow="رصيدك" title="مكافآتي" description="المكافآت المتاحة والمستخدمة والمنتهية." />{query.isLoading ? <LoadingPage /> : query.error ? <ErrorState /> : !query.data?.length ? <EmptyState title="لا توجد مكافآت" description="عند اكتمال بطاقة الولاء ستظهر المكافأة هنا." /> : <div className="coupon-grid">{query.data.map((reward) => <article key={reward.id}><Gift size={25} /><h2>{Number(reward.max_value).toFixed(2)} ر.س</h2><StatusPill tone={reward.status === "available" ? "success" : "neutral"}>{reward.status}</StatusPill><p>{reward.expires_at ? `تنتهي ${new Date(reward.expires_at).toLocaleDateString("ar-SA")}` : "بلا تاريخ انتهاء"}</p></article>)}</div>}</div>;
}

export function CouponsPage() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ["coupons"],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("coupons").select("id,code,name_ar,discount_type,discount_value,minimum_order,ends_at").eq("status", "active").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });
  if (!session) return <SignInRequired />;
  return <div><PageHeader eyebrow="عروضك" title="كوبوناتي" description="تتحقق صلاحية الكوبون وقيمته في الخادم عند إنشاء الطلب." />{!query.data?.length && !query.isLoading ? <EmptyState title="لا توجد كوبونات متاحة" description="الكوبونات الخاصة أو العامة ستظهر هنا عند تفعيلها." /> : <div className="coupon-grid">{query.data?.map((coupon) => <article key={coupon.id}><TicketPercent size={25} /><h2 dir="ltr">{coupon.code}</h2><strong>{coupon.name_ar}</strong><p>حد أدنى {Number(coupon.minimum_order).toFixed(2)} ر.س</p></article>)}</div>}</div>;
}

export function NotificationsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("notifications").select("*").order("created_at", { ascending: false }).range(0, 49);
      if (error) throw error;
      return data;
    },
  });
  async function read(id: string) {
    await getSupabase().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }
  if (!session) return <SignInRequired />;
  return <div><PageHeader eyebrow="كل جديد" title="الإشعارات" description="حالة الطلب والولاء والتنبيهات المهمة." />{query.isLoading ? <LoadingPage /> : !query.data?.length ? <EmptyState title="لا توجد إشعارات" description="سنظهر هنا فقط التنبيهات الحقيقية المرتبطة بحسابك." /> : <div className="notification-list">{query.data.map((item) => <button key={item.id} className={item.read_at ? "read" : ""} onClick={() => void read(item.id)}><span><Bell size={20} /></span><div><strong>{item.title_ar}</strong><p>{item.body_ar}</p><small>{new Date(item.created_at).toLocaleString("ar-SA")}</small></div>{!item.read_at && <i />}</button>)}</div>}</div>;
}

export function AssetsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["customer-assets"],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("customer_assets").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("اختر صورة أولًا");
      if (file.size > 20 * 1024 * 1024) throw new Error("حجم الصورة يتجاوز 20MB");
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${session!.user.id}/original/${crypto.randomUUID()}.${extension}`;
      const { error: storageError } = await getSupabase().storage.from("customer-assets").upload(path, file, { contentType: file.type });
      if (storageError) throw storageError;
      const { error } = await getSupabase().from("customer_assets").insert({
        customer_id: session!.user.id,
        original_path: path,
        mime_type: file.type,
        byte_size: file.size,
        processing_status: file.type === "image/png" ? "completed" : "uploaded",
      });
      if (error) throw error;
    },
    onSuccess: () => { setFile(null); setMessage("تم رفع الصورة بشكل خاص."); void queryClient.invalidateQueries({ queryKey: ["customer-assets"] }); },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر رفع الصورة"),
  });
  const removeBg = useMutation({
    mutationFn: async (assetId: string) => {
      const { data, error } = await getSupabase().functions.invoke("remove-background", { body: { asset_id: assetId, add_white_outline: true }, headers: { "idempotency-key": crypto.randomUUID() } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customer-assets"] }),
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر إزالة الخلفية"),
  });
  if (!session) return <SignInRequired />;
  return (
    <div><PageHeader eyebrow="مكتبتك الخاصة" title="صوري" description="صورك خاصة افتراضيًا وتُخدم بروابط موقعة فقط." />
      <section className="upload-card"><ImagePlus size={28} /><div><h2>ارفع صورتك</h2><p>PNG أو WebP أو JPEG حتى 20MB. لا يُدّعى نجاح إزالة الخلفية إذا لم تكن الخدمة مفعلة.</p></div><input type="file" accept="image/png,image/webp,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button busy={upload.isPending} onClick={() => upload.mutate()}><Upload size={18} /> رفع</Button></section>
      {message && <p className="form-message">{message}</p>}
      {!query.data?.length && !query.isLoading ? <EmptyState title="لا توجد صور خاصة" description="ارفع PNG شفافًا جاهزًا أو استخدم خدمة إزالة الخلفية عند تفعيلها." /> :
        <div className="asset-grid">{query.data?.map((asset) => <article key={asset.id}><div className="asset-placeholder"><ImagePlus size={34} /></div><StatusPill tone={asset.processing_status === "completed" ? "success" : asset.processing_status === "failed" ? "danger" : "warning"}>{asset.processing_status}</StatusPill><small>{(Number(asset.byte_size) / 1024 / 1024).toFixed(1)} MB</small>{asset.processing_status === "uploaded" && <Button variant="secondary" busy={removeBg.isPending} onClick={() => removeBg.mutate(asset.id)}>إزالة الخلفية</Button>}</article>)}</div>}
    </div>
  );
}

export function MarketingConsentPage() {
  const { session } = useAuth();
  const [consented, setConsented] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["marketing-consent"],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data } = await getSupabase().from("customer_marketing_consents").select("consented").eq("channel", "whatsapp").maybeSingle();
      setConsented(Boolean(data?.consented));
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().from("customer_marketing_consents").upsert({
        customer_id: session!.user.id,
        channel: "whatsapp",
        consented,
        consent_text_version: "2026-07",
        source: "customer_settings",
      }, { onConflict: "customer_id,channel" });
      if (error) throw error;
    },
    onSuccess: () => setMessage("تم حفظ اختيارك."),
  });
  if (!session) return <SignInRequired />;
  if (query.isLoading) return <LoadingPage />;
  return <div><PageHeader eyebrow="اختيارك محفوظ" title="الموافقة التسويقية" description="لن تدخل في أي حملة واتساب ما لم توافق صراحة." /><section className="consent-card"><ShieldCheck size={36} /><h2>رسائل العروض عبر واتساب</h2><p>رسائل حالة الطلب تشغيلية. أما العروض والحملات فلا تُرسل إلا بموافقتك ويمكنك سحبها في أي وقت.</p><label className="toggle-field"><input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} /><span>أوافق على استقبال العروض التسويقية</span></label>{message && <p className="form-message">{message}</p>}<Button busy={save.isPending} onClick={() => save.mutate()}><Save size={18} /> حفظ الاختيار</Button></section></div>;
}

export function LegalPage({ type }: { type: "terms" | "privacy" }) {
  const key = type === "terms" ? "terms_text" : "privacy_text";
  const query = useQuery({
    queryKey: ["legal", key],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("system_settings").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return data?.value as { title?: string; content?: string; version?: string } | null;
    },
  });
  const title = type === "terms" ? "الشروط والأحكام" : "سياسة الخصوصية";
  return <div><PageHeader eyebrow="معلومات قانونية" title={title} description={query.data?.version ? `الإصدار ${query.data.version}` : undefined} />{query.isLoading ? <LoadingPage /> : !query.data?.content ? <EmptyState title={`لم تُنشر ${title} بعد`} description="يجب على الإدارة إضافة النص المعتمد من صفحة الإعدادات قبل الإطلاق العام." /> : <article className="legal-content"><h2>{query.data.title || title}</h2><p>{query.data.content}</p></article>}</div>;
}
