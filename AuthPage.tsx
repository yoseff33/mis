"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgePercent,
  BarChart3,
  BellRing,
  Boxes,
  Building2,
  Car,
  ChevronLeft,
  ClipboardList,
  Coffee,
  Download,
  FileClock,
  Gift,
  Image as ImageIcon,
  LayoutDashboard,
  LockKeyhole,
  Megaphone,
  Menu,
  PackageCheck,
  ParkingCircle,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sticker,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/app/Providers";
import { Button, EmptyState, ErrorState, Field, LoadingPage, PageHeader, StatusPill } from "@/components/ui";
import { getSupabase } from "@/lib/supabase";
import type { Branch, Order } from "@/lib/types";
import { orderStatusAr } from "@/lib/types";

const adminNavigation = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "الطلبات", icon: ClipboardList },
  { to: "/admin/customers", label: "العملاء", icon: UsersRound },
  { to: "/admin/products", label: "المنتجات", icon: Coffee },
  { to: "/admin/categories", label: "التصنيفات", icon: Boxes },
  { to: "/admin/branches", label: "الفروع", icon: Building2 },
  { to: "/admin/parking", label: "المواقف", icon: ParkingCircle },
  { to: "/admin/staff", label: "الموظفون", icon: ShieldCheck },
  { to: "/admin/loyalty", label: "الولاء", icon: Gift },
  { to: "/admin/stickers", label: "الملصقات", icon: Sticker },
  { to: "/admin/campaigns", label: "الحملات", icon: Megaphone },
  { to: "/admin/coupons", label: "الكوبونات", icon: BadgePercent },
  { to: "/admin/payments", label: "المدفوعات", icon: WalletCards },
  { to: "/admin/reports", label: "التقارير", icon: BarChart3 },
  { to: "/admin/audit", label: "سجل العمليات", icon: FileClock },
  { to: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function AdminLayout() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  if (auth.loading) return <LoadingPage />;
  if (!auth.session || !auth.roles.some((role) => role !== "customer")) {
    return <EmptyState title="هذه المنطقة للموظفين المصرح لهم" description="حتى مع معرفة الرابط، تمنع RLS الوصول إلى البيانات دون دور وصلاحية." />;
  }
  return (
    <div className="admin-shell">
      <button className="admin-menu-button" onClick={() => setOpen((value) => !value)}><Menu size={19} /> أقسام الإدارة</button>
      <aside className={open ? "open" : ""}>
        <div className="admin-brand"><span><Coffee size={21} /></span><div><strong>تشغيل مِرسى</strong><small>{auth.roles.join(" • ")}</small></div></div>
        <nav>{adminNavigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}><Icon size={18} /> {label}<ChevronLeft size={15} /></NavLink>)}</nav>
      </aside>
      <section className="admin-content"><Outlet /></section>
    </div>
  );
}

function useAdminBranches() {
  return useQuery({
    queryKey: ["admin-branches"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("branches").select("id,name_ar,address,accepting_orders,expected_prep_minutes,status").is("deleted_at", null).order("name_ar");
      if (error) throw error;
      return data as Branch[];
    },
  });
}

export function AdminDashboardPage() {
  const branches = useAdminBranches();
  const [branchId, setBranchId] = useState("");
  const metrics = useQuery({
    queryKey: ["dashboard-metrics", branchId],
    queryFn: async () => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const { data, error } = await getSupabase().rpc("dashboard_metrics", {
        p_branch_id: branchId || null,
        p_from: from.toISOString(),
        p_to: new Date().toISOString(),
      });
      if (error) throw error;
      return data as { sales: number; orders: number; average_order_value: number; cancelled_orders: number; online_payments: number; cash_payments: number; new_customers: number };
    },
  });
  const trend = useQuery({
    queryKey: ["dashboard-trend", branchId],
    queryFn: async () => {
      const from = new Date(Date.now() - 6 * 86400000);
      from.setHours(0, 0, 0, 0);
      let query = getSupabase().from("orders").select("total,created_at,status").gte("created_at", from.toISOString()).in("status", ["delivered","partially_refunded"]);
      if (branchId) query = query.eq("branch_id", branchId);
      const { data, error } = await query;
      if (error) throw error;
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(from.getTime() + index * 86400000);
        const key = date.toISOString().slice(0, 10);
        return { key, day: date.toLocaleDateString("ar-SA", { weekday: "short" }), sales: 0 };
      });
      for (const order of data) {
        const day = days.find((item) => item.key === String(order.created_at).slice(0, 10));
        if (day) day.sales += Number(order.total);
      }
      return days;
    },
  });
  const m = metrics.data;
  return (
    <div><PageHeader eyebrow="تشغيل اليوم" title="صباح القهوة" description="أرقام فعلية من الطلبات والمدفوعات، تتغير حسب الفرع والتاريخ." action={<label className="select-field"><Building2 size={17} /><select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">كل الفروع</option>{branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_ar}</option>)}</select></label>} />
      {metrics.error ? <ErrorState onRetry={() => void metrics.refetch()} /> : (
        <>
          <section className="metric-grid">
            <Metric label="مبيعات اليوم" value={`${Number(m?.sales ?? 0).toFixed(2)} ر.س`} icon={WalletCards} tone="coffee" />
            <Metric label="الطلبات" value={String(m?.orders ?? 0)} icon={ReceiptText} tone="green" />
            <Metric label="متوسط الطلب" value={`${Number(m?.average_order_value ?? 0).toFixed(2)} ر.س`} icon={Activity} tone="amber" />
            <Metric label="الطلبات الملغاة" value={String(m?.cancelled_orders ?? 0)} icon={RefreshCw} tone="red" />
          </section>
          <div className="dashboard-grid">
            <section className="chart-card"><div><span><BarChart3 size={20} /></span><div><h2>مبيعات آخر 7 أيام</h2><p>طلبات مكتملة فقط</p></div></div>{trend.data?.some((day) => day.sales > 0) ? <ResponsiveContainer width="100%" height={270}><AreaChart data={trend.data}><defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9a613a" stopOpacity={0.35}/><stop offset="100%" stopColor="#9a613a" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e7dfd5" /><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${Number(value).toFixed(2)} ر.س`, "المبيعات"]} /><Area type="monotone" dataKey="sales" stroke="#895432" strokeWidth={3} fill="url(#salesFill)" /></AreaChart></ResponsiveContainer> : <EmptyState title="لا توجد مبيعات في الفترة" description="يظهر الرسم بعد تسليم أول طلب مدفوع." />}</section>
            <section className="operations-card"><div><span><BellRing size={20} /></span><div><h2>قنوات الدفع</h2><p>توزيع طلبات اليوم</p></div></div><div className="payment-split"><article><strong>{m?.online_payments ?? 0}</strong><span>دفع إلكتروني</span></article><article><strong>{m?.cash_payments ?? 0}</strong><span>عند الاستلام</span></article></div><Link className="text-link" to="/admin/orders">افتح شاشة التشغيل <ChevronLeft size={17} /></Link></section>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Activity; tone: string }) {
  return <article className={`metric metric--${tone}`}><span><Icon size={22} /></span><div><p>{label}</p><strong>{value}</strong></div></article>;
}

const statusNext: Record<string, string | undefined> = {
  confirmed: "preparing",
  preparing: "ready",
  ready: "out_for_delivery",
  out_for_delivery: "delivered",
};

export function OperationsBoardPage({ mode = "cashier" }: { mode?: "cashier" | "barista" | "delivery" }) {
  const queryClient = useQueryClient();
  const branches = useAdminBranches();
  const [branchId, setBranchId] = useState("");
  const allowedStatuses = mode === "barista" ? ["confirmed","preparing"] : mode === "delivery" ? ["ready","out_for_delivery"] : ["pending_payment","confirmed","preparing","ready","out_for_delivery"];
  const orders = useQuery({
    queryKey: ["operations-orders", branchId, mode],
    refetchInterval: 60_000,
    queryFn: async () => {
      let query = getSupabase().from("orders")
        .select("id,order_number,branch_id,status,fulfillment_type,payment_method,total,created_at,arrival_confirmed_at,customer_note,parking_spot_id,order_items(id,product_name_ar,quantity,customer_note,order_item_options(name_ar))")
        .in("status", allowedStatuses)
        .order("created_at");
      if (branchId) query = query.eq("branch_id", branchId);
      const { data, error } = await query.range(0, 99);
      if (error) throw error;
      return data as unknown as Array<Order & { order_items: Array<{ id: string; product_name_ar: string; quantity: number; customer_note: string | null; order_item_options: Array<{ name_ar: string }> }> }>;
    },
  });
  useEffect(() => {
    const channel = getSupabase().channel(`operations:${mode}:${branchId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", ...(branchId ? { filter: `branch_id=eq.${branchId}` } : {}) }, () => {
        void queryClient.invalidateQueries({ queryKey: ["operations-orders"] });
      }).subscribe();
    return () => { void getSupabase().removeChannel(channel); };
  }, [branchId, mode, queryClient]);
  const transition = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: string }) => {
      const { error } = await getSupabase().functions.invoke("transition-order", { body: { order_id: id, to_status: to } });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["operations-orders"] }),
  });
  const title = mode === "barista" ? "شاشة الباريستا" : mode === "delivery" ? "تسليم السيارات" : "إدارة الطلبات";
  return (
    <div className="operations-page"><PageHeader eyebrow="Realtime" title={title} description="تصل الطلبات وتتغير حالاتها لحظيًا عبر Supabase Realtime." action={<label className="select-field"><Building2 size={17} /><select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">كل الفروع المخولة</option>{branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_ar}</option>)}</select></label>} />
      {orders.isLoading ? <LoadingPage /> : orders.error ? <ErrorState onRetry={() => void orders.refetch()} /> : !orders.data?.length ? <EmptyState title="لا توجد طلبات في هذه المرحلة" description="ستظهر الطلبات المؤهلة هنا لحظيًا." /> :
        <div className="order-board">{allowedStatuses.map((status) => <section key={status}><header><h2>{orderStatusAr[status]}</h2><span>{orders.data.filter((order) => order.status === status).length}</span></header><div>{orders.data.filter((order) => order.status === status).map((order) => <article className={Date.now() - new Date(order.created_at).getTime() > 20 * 60_000 ? "late" : ""} key={order.id}><div className="order-card__head"><div><small>{Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000)} دقيقة</small><h3>{order.order_number}</h3></div><StatusPill tone={order.fulfillment_type === "car" ? "warning" : "neutral"}>{order.fulfillment_type === "car" ? <><Car size={14} /> سيارة</> : "استلام"}</StatusPill></div><div className="order-card__items">{order.order_items.map((item) => <p key={item.id}><strong>{item.quantity}×</strong> {item.product_name_ar}<small>{item.order_item_options.map((option) => option.name_ar).join("، ")}</small></p>)}</div>{mode !== "barista" && <div className="order-card__meta"><span>{order.payment_method === "online" ? "إلكتروني" : "عند الاستلام"}</span><strong>{Number(order.total).toFixed(2)} ر.س</strong></div>}{statusNext[order.status] && <Button busy={transition.isPending} onClick={() => transition.mutate({ id: order.id, to: statusNext[order.status]! })}>{order.status === "confirmed" ? "بدء التحضير" : order.status === "preparing" ? "جاهز" : order.status === "ready" ? "خرج للتسليم" : "تم التسليم"} <PackageCheck size={17} /></Button>}</article>)}</div></section>)}</div>}
    </div>
  );
}

type DataConfig = {
  title: string;
  eyebrow: string;
  description: string;
  table: string;
  select: string;
  order?: string;
  labels: Record<string, string>;
};

const dataConfigs: Record<string, DataConfig> = {
  customers: { title: "العملاء", eyebrow: "إدارة العملاء", description: "بحث وعرض الحسابات الحقيقية فقط.", table: "profiles", select: "id,member_number,full_name,phone,status,created_at", order: "created_at", labels: { member_number: "العضوية", full_name: "الاسم", phone: "الجوال", status: "الحالة", created_at: "الإنشاء" } },
  categories: { title: "التصنيفات", eyebrow: "كتالوج المنيو", description: "تصنيفات العرض وترتيبها.", table: "categories", select: "id,name_ar,slug,status,display_order,created_at", order: "display_order", labels: { name_ar: "الاسم", slug: "المعرّف", status: "الحالة", display_order: "الترتيب", created_at: "الإنشاء" } },
  branches: { title: "الفروع", eyebrow: "تعدد الفروع", description: "حالة استقبال الطلبات ووقت التحضير لكل فرع.", table: "branches", select: "id,name_ar,address,status,accepting_orders,expected_prep_minutes,created_at", order: "name_ar", labels: { name_ar: "الفرع", address: "العنوان", status: "الحالة", accepting_orders: "يستقبل", expected_prep_minutes: "التحضير", created_at: "الإنشاء" } },
  parking: { title: "المواقف", eyebrow: "طلبات السيارات", description: "رموز المواقف وحالتها لكل فرع.", table: "parking_spots", select: "id,branch_id,code,name_ar,status,location_hint,created_at", order: "code", labels: { code: "الرمز", name_ar: "الموقف", status: "الحالة", location_hint: "الموقع", branch_id: "الفرع", created_at: "الإنشاء" } },
  staff: { title: "الموظفون", eyebrow: "الفِرق", description: "الموظفون المخولون حسب الفرع.", table: "branch_staff", select: "id,branch_id,user_id,job_title,is_active,started_at,created_at", order: "created_at", labels: { user_id: "المستخدم", branch_id: "الفرع", job_title: "المسمى", is_active: "فعّال", started_at: "البداية", created_at: "الإنشاء" } },
  loyalty: { title: "حسابات الولاء", eyebrow: "برنامج الولاء", description: "الأرصدة مشتقة من Ledger ولا تعدل مباشرة.", table: "loyalty_accounts", select: "id,customer_id,program_id,cup_balance,lifetime_cups,level,updated_at", order: "updated_at", labels: { customer_id: "العميل", cup_balance: "الأكواب", lifetime_cups: "الإجمالي", level: "المستوى", updated_at: "التحديث" } },
  stickers: { title: "الملصقات", eyebrow: "مكتبة الكوفي", description: "ملصقات عامة تملك الإدارة حقوق استخدامها.", table: "stickers", select: "id,name_ar,status,is_global,is_seasonal,requires_unlock,rights_confirmed,created_at", order: "created_at", labels: { name_ar: "الاسم", status: "الحالة", is_global: "عام", is_seasonal: "موسمي", requires_unlock: "يتطلب فتح", rights_confirmed: "الحقوق", created_at: "الإنشاء" } },
  campaigns: { title: "الحملات", eyebrow: "تسويق بموافقة", description: "لا تستهدف إلا العملاء الموافقين.", table: "campaigns", select: "id,name,status,target_count,sent_count,success_count,failed_count,attributed_revenue,created_at", order: "created_at", labels: { name: "الحملة", status: "الحالة", target_count: "المستهدف", success_count: "ناجح", failed_count: "فاشل", attributed_revenue: "الإيراد", created_at: "الإنشاء" } },
  coupons: { title: "الكوبونات", eyebrow: "العروض", description: "التحقق والقيمة يطبقان في الخادم.", table: "coupons", select: "id,code,name_ar,discount_type,discount_value,status,starts_at,ends_at", order: "created_at", labels: { code: "الكود", name_ar: "الاسم", discount_type: "النوع", discount_value: "القيمة", status: "الحالة", starts_at: "البداية", ends_at: "النهاية" } },
  payments: { title: "المدفوعات", eyebrow: "مالية محمية", description: "لا تظهر ناجحة إلا بعد Webhook موثوق.", table: "payments", select: "id,order_id,provider,amount,currency,status,paid_at,created_at", order: "created_at", labels: { order_id: "الطلب", provider: "المزود", amount: "القيمة", currency: "العملة", status: "الحالة", paid_at: "الدفع", created_at: "الإنشاء" } },
  audit: { title: "سجل العمليات", eyebrow: "Audit Log", description: "سجل append-only لا يمكن تعديله أو حذفه.", table: "audit_logs", select: "id,actor_id,action,table_name,record_id,branch_id,reason,created_at", order: "created_at", labels: { actor_id: "المنفذ", action: "العملية", table_name: "الجدول", record_id: "العنصر", reason: "السبب", created_at: "الوقت" } },
};

export function DataManagementPage({ kind }: { kind: keyof typeof dataConfigs }) {
  const config = dataConfigs[kind];
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["admin-data", kind],
    queryFn: async () => {
      const { data, error } = await getSupabase().from(config.table).select(config.select).order(config.order ?? "created_at", { ascending: config.order === "display_order" || config.order === "name_ar" });
      if (error) throw error;
      return data as unknown as Array<Record<string, unknown>>;
    },
  });
  const filtered = useMemo(() => query.data?.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())) ?? [], [query.data, search]);
  return (
    <div><PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} />
      <label className="search-field admin-search"><Activity size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`ابحث في ${config.title}`} /></label>
      {query.isLoading ? <LoadingPage /> : query.error ? <ErrorState onRetry={() => void query.refetch()} /> : !filtered.length ? <EmptyState title={`لا توجد بيانات في ${config.title}`} description="هذه حالة فارغة حقيقية؛ لم يضف النظام أي بيانات تجريبية." /> :
        <div className="data-table-wrap"><table><thead><tr>{Object.values(config.labels).map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={String(row.id)}>{Object.keys(config.labels).map((key) => <td key={key}>{typeof row[key] === "boolean" ? row[key] ? "نعم" : "لا" : key.includes("at") && row[key] ? new Date(String(row[key])).toLocaleString("ar-SA") : String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table></div>}
    </div>
  );
}

export function ReportsPage() {
  const [report, setReport] = useState("sales");
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("xlsx");
  const [message, setMessage] = useState<string | null>(null);
  const exportReport = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().functions.invoke("report-export", { body: { report, format } });
      if (error) throw error;
      const { data: signed, error: signedError } = await getSupabase().functions.invoke("signed-file-url", { body: { bucket: "exports", path: data.path, expires_in: 300 } });
      if (signedError) throw signedError;
      return signed.signed_url as string;
    },
    onSuccess: (url) => { setMessage("تم إنشاء التقرير من البيانات الحقيقية."); window.location.assign(url); },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر إنشاء التقرير"),
  });
  return (
    <div><PageHeader eyebrow="تصدير حقيقي" title="التقارير" description="CSV وExcel من قاعدة البيانات، وPDF عبر خدمة تحويل عربية عند تفعيلها." />
      <section className="report-builder">
        <Field label="نوع التقرير"><select value={report} onChange={(event) => setReport(event.target.value)}><option value="sales">المبيعات</option><option value="orders">الطلبات</option><option value="payments">المدفوعات</option><option value="refunds">الاسترجاعات</option><option value="products">المنتجات</option><option value="customers">العملاء</option><option value="loyalty">الولاء</option><option value="campaigns">الحملات</option><option value="coupons">الكوبونات</option><option value="stickers">الملصقات</option><option value="assets">الصور المرفوعة</option></select></Field>
        <Field label="الصيغة"><select value={format} onChange={(event) => setFormat(event.target.value as "csv" | "xlsx" | "pdf")}><option value="xlsx">Excel</option><option value="csv">CSV</option><option value="pdf">PDF</option></select></Field>
        <Button busy={exportReport.isPending} onClick={() => exportReport.mutate()}><Download size={18} /> إنشاء وتنزيل</Button>
        {message && <p className="form-message">{message}</p>}
      </section>
    </div>
  );
}

export function SettingsPage() {
  const [identity, setIdentity] = useState({ name: "", currency: "SAR", locale: "ar-SA" });
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["settings-identity"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("system_settings").select("id,value").eq("key", "coffee_identity").maybeSingle();
      if (error) throw error;
      if (data?.value) setIdentity(data.value as typeof identity);
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await getSupabase().from("system_settings").update({ value: identity }).eq("key", "coffee_identity");
      if (error) throw error;
    },
    onSuccess: () => setMessage("تم حفظ إعدادات الهوية."),
  });
  return <div><PageHeader eyebrow="إعدادات النظام" title="الهوية والتشغيل" description="الإعدادات الحساسة محمية ولا يراها غير المخول." />{query.isLoading ? <LoadingPage /> : <div className="settings-sections"><section className="settings-card form-stack"><h2>هوية الكوفي</h2><Field label="الاسم"><input value={identity.name} onChange={(event) => setIdentity({ ...identity, name: event.target.value })} /></Field><Field label="العملة"><select value={identity.currency} onChange={(event) => setIdentity({ ...identity, currency: event.target.value })}><option value="SAR">ريال سعودي (SAR)</option></select></Field>{message && <p className="form-message">{message}</p>}<Button busy={save.isPending} onClick={() => save.mutate()}><Settings size={18} /> حفظ</Button></section><section className="integration-status"><h2>حالة التكاملات</h2><article><LockKeyhole size={20} /><div><strong>بوابة الدفع</strong><span>تُقرأ المفاتيح من Edge Functions فقط.</span></div><StatusPill tone="info">خادمي</StatusPill></article><article><Megaphone size={20} /><div><strong>واتساب</strong><span>لا تسجل رسالة كمرسلة دون معرف من المزود.</span></div><StatusPill tone="info">خادمي</StatusPill></article><article><ImageIcon size={20} /><div><strong>إزالة الخلفية</strong><span>تتعطل بوضوح عند غياب مفتاح الخدمة.</span></div><StatusPill tone="info">خادمي</StatusPill></article></section></div>}</div>;
}

export function ProductManagementPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name_ar: "",
    slug: "",
    category_id: "",
    branch_id: "",
    base_price: "",
    sku: "",
    description_ar: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("products")
        .select("id,name_ar,sku,base_price,status,created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(0, 99);
      if (error) throw error;
      return data;
    },
  });
  const lookups = useQuery({
    queryKey: ["product-lookups"],
    queryFn: async () => {
      const [{ data: categories, error }, { data: branches }] = await Promise.all([
        getSupabase().from("categories").select("id,name_ar").eq("status", "active"),
        getSupabase().from("branches").select("id,name_ar").eq("status", "active"),
      ]);
      if (error) throw error;
      return { categories: categories ?? [], branches: branches ?? [] };
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      if (!form.category_id || !form.branch_id) throw new Error("اختر التصنيف والفرع");
      const supabase = getSupabase();
      let imagePath: string | null = null;
      if (imageFile) {
        if (imageFile.size > 10 * 1024 * 1024) throw new Error("صورة المنتج تتجاوز 10MB");
        const extension = imageFile.name.split(".").pop()?.toLowerCase() ?? "png";
        imagePath = `products/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(imagePath, imageFile, { contentType: imageFile.type });
        if (uploadError) throw uploadError;
      }
      const { data: product, error } = await supabase.from("products").insert({
        category_id: form.category_id,
        name_ar: form.name_ar,
        slug: form.slug,
        description_ar: form.description_ar || null,
        base_price: Number(form.base_price),
        sku: form.sku || null,
        image_path: imagePath,
        status: "active",
      }).select("id").single();
      if (error) throw error;
      const { error: availabilityError } = await supabase.from("product_branch_availability").insert({
        product_id: product.id,
        branch_id: form.branch_id,
        is_available: true,
      });
      if (availabilityError) throw availabilityError;
    },
    onSuccess: () => {
      setForm({ name_ar: "", slug: "", category_id: "", branch_id: "", base_price: "", sku: "", description_ar: "" });
      setImageFile(null);
      setMessage("تم إنشاء المنتج وإتاحته للفرع.");
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر إنشاء المنتج"),
  });
  return (
    <div><PageHeader eyebrow="كتالوج حقيقي" title="إدارة المنتجات" description="كل منتج يُحفظ في Supabase ويظهر للعميل حسب توفر الفرع." />
      <div className="two-column admin-form-layout">
        <section>
          {products.isLoading ? <LoadingPage /> : !products.data?.length ? <EmptyState title="لا توجد منتجات" description="أضف أول منتج من النموذج." /> :
            <div className="data-table-wrap"><table><thead><tr><th>المنتج</th><th>SKU</th><th>السعر</th><th>الحالة</th></tr></thead><tbody>{products.data.map((product) => <tr key={product.id}><td>{product.name_ar}</td><td dir="ltr">{product.sku || "—"}</td><td>{Number(product.base_price).toFixed(2)} ر.س</td><td><StatusPill tone={product.status === "active" ? "success" : "neutral"}>{product.status}</StatusPill></td></tr>)}</tbody></table></div>}
        </section>
        <form className="settings-card form-stack" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}>
          <h2>منتج جديد</h2>
          <Field label="الاسم العربي"><input required value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} /></Field>
          <Field label="المعرّف"><input required dir="ltr" pattern="[a-z][a-z0-9-]{2,64}" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></Field>
          <Field label="التصنيف"><select required value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">اختر</option>{lookups.data?.categories.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}</select></Field>
          <Field label="الفرع"><select required value={form.branch_id} onChange={(event) => setForm({ ...form, branch_id: event.target.value })}><option value="">اختر</option>{lookups.data?.branches.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}</select></Field>
          <Field label="السعر"><input required dir="ltr" type="number" min="0" step="0.01" value={form.base_price} onChange={(event) => setForm({ ...form, base_price: event.target.value })} /></Field>
          <Field label="SKU"><input dir="ltr" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></Field>
          <Field label="الوصف"><textarea value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })} /></Field>
          <Field label="صورة المنتج"><input type="file" accept="image/png,image/webp,image/jpeg" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} /></Field>
          {message && <p className="form-message">{message}</p>}
          <Button type="submit" busy={add.isPending}><Coffee size={18} /> حفظ المنتج</Button>
        </form>
      </div>
    </div>
  );
}

export function StickerCreatePage() {
  const [form, setForm] = useState({ name_ar: "", category_id: "", is_global: true, is_seasonal: false, rights_confirmed: false });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const categories = useQuery({
    queryKey: ["sticker-categories"],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("sticker_categories").select("id,name_ar").eq("status", "active").order("display_order");
      if (error) throw error;
      return data;
    },
  });
  const add = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("اختر ملف الملصق");
      if (!["image/png","image/webp"].includes(file.type)) throw new Error("الملصقات تقبل PNG وWebP فقط؛ SVG يحتاج تنظيفًا خادميًا");
      if (!form.rights_confirmed) throw new Error("يجب تأكيد حقوق استخدام الملصق");
      const path = `stickers/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : "webp"}`;
      const supabase = getSupabase();
      const { error: uploadError } = await supabase.storage.from("sticker-assets").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("stickers").insert({
        name_ar: form.name_ar,
        category_id: form.category_id || null,
        asset_path: path,
        is_global: form.is_global,
        is_seasonal: form.is_seasonal,
        rights_confirmed: form.rights_confirmed,
        status: "active",
        created_by: user.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { setMessage("تم نشر الملصق للعملاء المؤهلين."); setFile(null); },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر رفع الملصق"),
  });
  return <div><PageHeader eyebrow="محتوى مرخّص" title="إضافة ملصق" description="لا يقبل النظام SVG الخام، ولا ينشر الملف دون تأكيد حقوق استخدامه." backTo="/admin/stickers" /><form className="settings-card form-stack narrow-form" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}><Field label="اسم الملصق"><input required value={form.name_ar} onChange={(event) => setForm({ ...form, name_ar: event.target.value })} /></Field><Field label="التصنيف"><select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">بدون تصنيف</option>{categories.data?.map((item) => <option key={item.id} value={item.id}>{item.name_ar}</option>)}</select></Field><Field label="الملف"><input required type="file" accept="image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field><label className="toggle-field"><input type="checkbox" checked={form.is_global} onChange={(event) => setForm({ ...form, is_global: event.target.checked })} /><span>متاح لجميع الفروع</span></label><label className="toggle-field"><input type="checkbox" checked={form.is_seasonal} onChange={(event) => setForm({ ...form, is_seasonal: event.target.checked })} /><span>ملصق موسمي</span></label><label className="toggle-field"><input required type="checkbox" checked={form.rights_confirmed} onChange={(event) => setForm({ ...form, rights_confirmed: event.target.checked })} /><span>أؤكد امتلاك حق استخدام هذا المحتوى</span></label>{message && <p className="form-message">{message}</p>}<Button type="submit" busy={add.isPending}><Sticker size={18} /> نشر الملصق</Button></form></div>;
}

export function PlaceholderProtectedPage({ title, table }: { title: string; table: string }) {
  const query = useQuery({
    queryKey: ["protected-count", table],
    queryFn: async () => {
      const { count, error } = await getSupabase().from(table).select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
  return <div><PageHeader eyebrow="صفحة محمية" title={title} description="هذه الصفحة متصلة بالجدول الحقيقي وتخضع لصلاحيات RLS." />{query.isLoading ? <LoadingPage /> : query.error ? <ErrorState /> : <EmptyState title={`${query.data} سجل متاح لصلاحيتك`} description="تتحدد البيانات والعمليات التي تظهر لك حسب الدور والفرع في قاعدة البيانات." />}</div>;
}
