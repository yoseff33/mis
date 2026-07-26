"use client";
/* eslint-disable @next/next/no-img-element -- URLs come from the configured Supabase Storage project. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Coffee,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth, useCart } from "@/app/Providers";
import { Button, EmptyState, ErrorState, Field, LoadingPage, PageHeader, StatusPill } from "@/components/ui";
import { getSupabase, publicAssetUrl } from "@/lib/supabase";
import type { Branch, Category, Order, Product } from "@/lib/types";
import { orderStatusAr } from "@/lib/types";

function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("branches")
        .select("id,name_ar,address,accepting_orders,expected_prep_minutes,status")
        .is("deleted_at", null)
        .order("name_ar");
      if (error) throw error;
      return data as Branch[];
    },
  });
}

function useMenu(branchId?: string | null) {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("categories")
        .select("id,name_ar,slug")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });
  const products = useQuery({
    queryKey: ["products", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("products")
        .select("id,category_id,name_ar,description_ar,image_path,base_price,prep_minutes,product_branch_availability!inner(branch_id,price_override,is_available)")
        .eq("status", "active")
        .is("deleted_at", null)
        .eq("product_branch_availability.branch_id", branchId!)
        .eq("product_branch_availability.is_available", true)
        .order("display_order");
      if (error) throw error;
      return data as Product[];
    },
  });
  return { categories, products };
}

function productPrice(product: Product) {
  return Number(product.product_branch_availability?.[0]?.price_override ?? product.base_price);
}

export function HomePage() {
  const { data: branches, isLoading, error, refetch } = useBranches();
  const firstBranch = branches?.find((branch) => branch.accepting_orders) ?? branches?.[0];
  const { products } = useMenu(firstBranch?.id);
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero__copy">
          <span className="eyebrow"><Sparkles size={15} /> من الباريستا إلى سيارتك</span>
          <h1>قهوتك جاهزة<br /><em>قبل ما تطفي السيارة.</em></h1>
          <p>اختر فرعك، اطلب من المنيو، ونتابع معك الطلب لحظة بلحظة حتى التسليم.</p>
          <div className="hero__actions">
            <Link className="button button--primary" to={firstBranch ? `/menu?branch=${firstBranch.id}` : "/branches"}>
              اطلب الحين <ArrowLeft size={18} />
            </Link>
            <Link className="button button--secondary" to="/loyalty">بطاقة الولاء</Link>
          </div>
          {firstBranch && (
            <div className="branch-quick">
              <span><MapPin size={18} /></span>
              <div><small>الفرع المختار</small><strong>{firstBranch.name_ar}</strong></div>
              <em><Clock3 size={15} /> {firstBranch.expected_prep_minutes} دقيقة</em>
              <Link to="/branches">تغيير</Link>
            </div>
          )}
        </div>
        <div className="hero__visual" aria-hidden>
          <div className="hero-card">
            <span className="hero-card__steam">〰</span>
            <div className="coffee-cup"><Coffee size={56} /></div>
            <div><span>طلبك القادم</span><strong>قهوة على مزاجك</strong></div>
          </div>
          <span className="floating-chip floating-chip--one"><Clock3 size={17} /> متابعة لحظية</span>
          <span className="floating-chip floating-chip--two"><Car size={17} /> تسليم للموقف</span>
        </div>
      </section>

      <section className="value-strip">
        <article><span>01</span><div><strong>امسح QR</strong><p>الفرع والموقف يتحددان تلقائيًا.</p></div></article>
        <article><span>02</span><div><strong>اطلب وادفع</strong><p>سعر محسوب وآمن من الخادم.</p></div></article>
        <article><span>03</span><div><strong>نوصله لك</strong><p>تحديثات حية حتى باب سيارتك.</p></div></article>
      </section>

      <section className="section-block">
        <PageHeader eyebrow="من المنيو" title="وش مزاجك اليوم؟" description="المنتجات هنا تأتي مباشرة من قاعدة بيانات الكوفي." action={<Link to="/menu" className="text-link">شوف المنيو <ChevronLeft size={17} /></Link>} />
        {isLoading || products.isLoading ? <LoadingPage label="نجهز المنيو…" /> : error || products.error ? (
          <ErrorState onRetry={() => { void refetch(); void products.refetch(); }} />
        ) : !products.data?.length ? (
          <EmptyState title="المنيو ينتظر أول منتج" description="بعد إضافة المنتجات من الإدارة ستظهر هنا مباشرة." />
        ) : (
          <div className="product-row">
            {products.data.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} branchId={firstBranch!.id} />)}
          </div>
        )}
      </section>
    </div>
  );
}

export function BranchesPage() {
  const { data, isLoading, error, refetch } = useBranches();
  const navigate = useNavigate();
  if (isLoading) return <LoadingPage label="نبحث عن الفروع…" />;
  return (
    <div>
      <PageHeader eyebrow="اختر الأقرب" title="فروعنا" description="شوف حالة الفرع ووقت التحضير قبل الطلب." />
      {error ? <ErrorState onRetry={() => void refetch()} /> : !data?.length ? (
        <EmptyState title="لا توجد فروع متاحة" description="أضف أول فرع من شاشة الإعداد أو لوحة الإدارة." />
      ) : (
        <div className="branch-grid">
          {data.map((branch) => (
            <article className="branch-card" key={branch.id}>
              <div className="branch-card__top"><span><Store size={22} /></span><StatusPill tone={branch.accepting_orders ? "success" : "warning"}>{branch.accepting_orders ? "يستقبل طلبات" : "متوقف مؤقتًا"}</StatusPill></div>
              <h2>{branch.name_ar}</h2>
              <p><MapPin size={16} /> {branch.address}</p>
              <p><Clock3 size={16} /> تحضير متوقع {branch.expected_prep_minutes} دقيقة</p>
              <Button disabled={!branch.accepting_orders} onClick={() => navigate(`/menu?branch=${branch.id}`)}>اختيار الفرع</Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, branchId }: { product: Product; branchId: string }) {
  const cart = useCart();
  const image = publicAssetUrl("product-images", product.image_path);
  const price = productPrice(product);
  return (
    <article className="product-card">
      <Link to={`/product/${product.id}?branch=${branchId}`} className="product-card__image">
        {image ? <img src={image} alt={product.name_ar} /> : <span><Coffee size={42} /></span>}
      </Link>
      <div className="product-card__body">
        <Link to={`/product/${product.id}?branch=${branchId}`}><h3>{product.name_ar}</h3></Link>
        <p>{product.description_ar || "تفاصيل المنتج متاحة من إدارة المنيو."}</p>
        <div><strong>{price.toFixed(2)} <small>ر.س</small></strong>
          <button aria-label={`أضف ${product.name_ar}`} onClick={() => cart.add({
            product_id: product.id,
            name_ar: product.name_ar,
            display_price: price,
            quantity: 1,
            option_value_ids: [],
          })}><Plus size={20} /></button>
        </div>
      </div>
    </article>
  );
}

export function MenuPage() {
  const branches = useBranches();
  const [searchParams, setSearchParams] = useSearchParams();
  const branchId = searchParams.get("branch") ?? branches.data?.find((branch) => branch.accepting_orders)?.id ?? branches.data?.[0]?.id;
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { categories, products } = useMenu(branchId);
  const visible = useMemo(() => products.data?.filter((product) =>
    (!categoryId || product.category_id === categoryId) &&
    (!search || product.name_ar.includes(search))
  ) ?? [], [products.data, categoryId, search]);

  return (
    <div>
      <PageHeader eyebrow="منيو الكوفي" title="اختر طلبك" description="الأسعار والتوفر محدثة حسب الفرع المختار." />
      <div className="menu-toolbar">
        <label className="select-field"><MapPin size={18} /><select value={branchId ?? ""} onChange={(event) => setSearchParams({ branch: event.target.value })}>
          <option value="" disabled>اختر فرعًا</option>
          {branches.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name_ar}</option>)}
        </select></label>
        <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في المنيو" /></label>
      </div>
      <div className="category-tabs">
        <button className={!categoryId ? "active" : ""} onClick={() => setCategoryId(null)}>الكل</button>
        {categories.data?.map((category) => <button className={categoryId === category.id ? "active" : ""} key={category.id} onClick={() => setCategoryId(category.id)}>{category.name_ar}</button>)}
      </div>
      {branches.isLoading || categories.isLoading || products.isLoading ? <LoadingPage label="نحمّل المنيو…" /> :
        branches.error || categories.error || products.error ? <ErrorState onRetry={() => { void branches.refetch(); void categories.refetch(); void products.refetch(); }} /> :
        !branchId ? <EmptyState title="اختر فرعًا أولًا" description="الأسعار والتوفر يختلفان حسب الفرع." action={<Link className="button button--primary" to="/branches">اختيار الفرع</Link>} /> :
        !visible.length ? <EmptyState title="ما لقينا منتجات" description={search ? "جرّب كلمة بحث أخرى." : "لا توجد منتجات متاحة لهذا التصنيف والفرع."} /> :
        <div className="product-grid">{visible.map((product) => <ProductCard key={product.id} product={product} branchId={branchId} />)}</div>}
    </div>
  );
}

export function ProductPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get("branch");
  const navigate = useNavigate();
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const product = useQuery({
    queryKey: ["product", productId, branchId],
    enabled: Boolean(productId && branchId),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("products")
        .select("id,category_id,name_ar,description_ar,image_path,base_price,prep_minutes,product_branch_availability!inner(branch_id,price_override,is_available),product_option_groups(id,name_ar,is_required,min_select,max_select,product_options(id,name_ar,product_option_values(id,name_ar,price_delta,status)))")
        .eq("id", productId!)
        .eq("product_branch_availability.branch_id", branchId!)
        .single();
      if (error) throw error;
      return data as Product & { product_option_groups: Array<{ id: string; name_ar: string; is_required: boolean; min_select: number; max_select: number; product_options: Array<{ id: string; name_ar: string; product_option_values: Array<{ id: string; name_ar: string; price_delta: number; status: string }> }> }> };
    },
  });
  if (product.isLoading) return <LoadingPage label="نجهز تفاصيل المنتج…" />;
  if (product.error || !product.data) return <ErrorState message="تعذر تحميل المنتج" onRetry={() => void product.refetch()} />;
  const price = productPrice(product.data);
  const image = publicAssetUrl("product-images", product.data.image_path);

  function add() {
    for (const group of product.data!.product_option_groups) {
      const values = group.product_options.flatMap((option) => option.product_option_values.map((value) => value.id));
      const count = selected.filter((id) => values.includes(id)).length;
      if (count < group.min_select || count > group.max_select) return;
    }
    cart.add({ product_id: product.data!.id, name_ar: product.data!.name_ar, display_price: price, quantity, note, option_value_ids: selected });
    navigate("/cart");
  }
  return (
    <div className="product-detail">
      <div className="product-detail__image">{image ? <img src={image} alt={product.data.name_ar} /> : <Coffee size={86} />}</div>
      <section className="product-detail__content">
        <Link to={`/menu?branch=${branchId}`} className="back-link"><ArrowLeft size={17} /> رجوع للمنيو</Link>
        <h1>{product.data.name_ar}</h1>
        <p>{product.data.description_ar || "لا يوجد وصف إضافي لهذا المنتج."}</p>
        <strong className="product-detail__price">{price.toFixed(2)} ر.س</strong>
        {product.data.product_option_groups.map((group) => (
          <fieldset className="option-group" key={group.id}>
            <legend>{group.name_ar} {group.is_required && <small>مطلوب</small>}</legend>
            {group.product_options.flatMap((option) => option.product_option_values).filter((value) => value.status === "active").map((value) => (
              <label key={value.id}><input type={group.max_select === 1 ? "radio" : "checkbox"} name={group.id} checked={selected.includes(value.id)} onChange={(event) => setSelected((current) => {
                const groupValueIds = group.product_options.flatMap((option) => option.product_option_values.map((item) => item.id));
                if (group.max_select === 1) return [...current.filter((id) => !groupValueIds.includes(id)), value.id];
                return event.target.checked ? [...current, value.id] : current.filter((id) => id !== value.id);
              })} /><span>{value.name_ar}</span><em>{Number(value.price_delta) > 0 ? `+${Number(value.price_delta).toFixed(2)} ر.س` : "بدون زيادة"}</em></label>
            ))}
          </fieldset>
        ))}
        <Field label="ملاحظة للباريستا"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} /></Field>
        <div className="add-bar">
          <div className="quantity"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={18} /></button><strong>{quantity}</strong><button onClick={() => setQuantity((value) => Math.min(20, value + 1))}><Plus size={18} /></button></div>
          <Button onClick={add}><ShoppingBag size={18} /> أضف للسلة</Button>
        </div>
      </section>
    </div>
  );
}

export function CartPage() {
  const cart = useCart();
  const auth = useAuth();
  const branches = useBranches();
  const navigate = useNavigate();
  const [branchId, setBranchId] = useState("");
  const [fulfillment, setFulfillment] = useState<"car" | "window" | "inside">("car");
  const [payment, setPayment] = useState<"cash" | "online">("cash");
  const [coupon, setCoupon] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [idempotency, setIdempotency] = useState(() => crypto.randomUUID());
  const vehicles = useQuery({
    queryKey: ["vehicles", auth.session?.user.id],
    enabled: Boolean(auth.session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("customer_vehicles").select("*").is("deleted_at", null).order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [vehicleId, setVehicleId] = useState("");
  const parking = useQuery({
    queryKey: ["parking", branchId],
    enabled: Boolean(branchId && fulfillment === "car"),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("parking_spots").select("id,code,name_ar,status").eq("branch_id", branchId).eq("status", "available").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });
  const [parkingId, setParkingId] = useState("");
  const displaySubtotal = cart.items.reduce((sum, item) => sum + item.display_price * item.quantity, 0);
  const createOrder = useMutation({
    mutationFn: async () => {
      if (!auth.session) throw new Error("سجّل الدخول قبل إتمام الطلب");
      if (!branchId) throw new Error("اختر الفرع");
      if (fulfillment === "car" && !vehicleId) throw new Error("اختر السيارة");
      const { data, error } = await getSupabase().functions.invoke("create-order", {
        body: {
          branch_id: branchId,
          parking_spot_id: fulfillment === "car" ? parkingId || null : null,
          vehicle_id: fulfillment === "car" ? vehicleId : null,
          fulfillment_type: fulfillment,
          payment_method: payment,
          coupon_code: coupon || undefined,
          customer_note: note || undefined,
          items: cart.items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            note: item.note,
            option_value_ids: item.option_value_ids,
          })),
        },
        headers: { "idempotency-key": idempotency },
      });
      if (error) throw new Error(error.message);
      return data.order as { order_id: string; order_number: string; status: string };
    },
    onSuccess: (order) => {
      cart.clear();
      setIdempotency(crypto.randomUUID());
      navigate(payment === "online" ? `/payment/${order.order_id}` : `/track/${order.order_id}`);
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : "تعذر إنشاء الطلب"),
  });

  if (!cart.items.length) return <EmptyState title="سلتك فاضية" description="اختَر قهوتك وإضافاتك من المنيو." action={<Link className="button button--primary" to="/menu">تصفح المنيو</Link>} />;
  return (
    <div>
      <PageHeader eyebrow="راجِع طلبك" title="السلة وإتمام الطلب" description="السعر النهائي سيُعاد حسابه من الخادم لحظة إنشاء الطلب." />
      <div className="checkout-layout">
        <section className="cart-list">
          {cart.items.map((item) => (
            <article key={item.key}><span className="cart-list__icon"><Coffee size={22} /></span><div><h3>{item.name_ar}</h3>{item.note && <p>{item.note}</p>}<strong>{(item.display_price * item.quantity).toFixed(2)} ر.س</strong></div>
              <div className="quantity"><button onClick={() => cart.updateQuantity(item.key, item.quantity - 1)}><Minus size={16} /></button><strong>{item.quantity}</strong><button onClick={() => cart.updateQuantity(item.key, item.quantity + 1)}><Plus size={16} /></button></div>
              <button className="remove-link" onClick={() => cart.remove(item.key)}>حذف</button>
            </article>
          ))}
          <div className="cart-summary"><span>الإجمالي المعروض</span><strong>{displaySubtotal.toFixed(2)} ر.س</strong><small>الضريبة والخصم والقيمة النهائية يحسبها الخادم.</small></div>
        </section>
        <section className="checkout-form">
          <h2>تفاصيل الاستلام</h2>
          <Field label="الفرع"><select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">اختر الفرع</option>{branches.data?.filter((branch) => branch.accepting_orders).map((branch) => <option key={branch.id} value={branch.id}>{branch.name_ar}</option>)}</select></Field>
          <div className="fulfillment-options">{(["car","window","inside"] as const).map((value) => <button className={fulfillment === value ? "active" : ""} key={value} onClick={() => setFulfillment(value)}>{value === "car" ? <Car size={18} /> : <Store size={18} />}{value === "car" ? "السيارة" : value === "window" ? "الشباك" : "داخل الكوفي"}</button>)}</div>
          {fulfillment === "car" && (
            <>
              <Field label="السيارة"><select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">اختر سيارة</option>{vehicles.data?.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} — {vehicle.color}</option>)}</select></Field>
              <Field label="الموقف"><select value={parkingId} onChange={(event) => setParkingId(event.target.value)}><option value="">سأحدده عند الوصول</option>{parking.data?.map((spot) => <option key={spot.id} value={spot.id}>{spot.name_ar}</option>)}</select></Field>
            </>
          )}
          <Field label="كوبون"><input dir="ltr" value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} /></Field>
          <Field label="ملاحظة على الطلب"><textarea value={note} onChange={(event) => setNote(event.target.value)} /></Field>
          <div className="payment-options"><button className={payment === "cash" ? "active" : ""} onClick={() => setPayment("cash")}><WalletCards size={19} /> عند الاستلام</button><button className={payment === "online" ? "active" : ""} onClick={() => setPayment("online")}><CreditCard size={19} /> إلكتروني</button></div>
          {error && <p className="form-message form-message--error">{error}</p>}
          {!auth.session ? <Link className="button button--primary" to="/login">سجّل الدخول لإكمال الطلب</Link> : <Button busy={createOrder.isPending} onClick={() => createOrder.mutate()}><ShieldCheck size={18} /> تأكيد وإنشاء الطلب</Button>}
        </section>
      </div>
    </div>
  );
}

type TokenResponse = { id?: string; token?: string; message?: string; errors?: unknown };

export function PaymentPage() {
  const { orderId } = useParams();
  const [message, setMessage] = useState<string | null>(null);
  const order = useQuery({
    queryKey: ["payment-order", orderId],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("orders").select("id,order_number,total,currency,status").eq("id", orderId!).single();
      if (error) throw error;
      return data;
    },
  });
  const [card, setCard] = useState({ name: "", number: "", month: "", year: "", cvc: "" });
  const pay = useMutation({
    mutationFn: async () => {
      const publishable = process.env.NEXT_PUBLIC_PAYMENT_PUBLIC_KEY;
      if (!publishable) throw new Error("الدفع الإلكتروني غير مفعّل. تواصل مع إدارة الكوفي.");
      const tokenResponse = await fetch(`${process.env.NEXT_PUBLIC_PAYMENT_API_URL ?? "https://api.moyasar.com/v1"}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishable_api_key: publishable,
          name: card.name,
          number: card.number.replace(/\s/g, ""),
          month: Number(card.month),
          year: Number(card.year),
          cvc: card.cvc,
          save_only: true,
        }),
      });
      const token = await tokenResponse.json() as TokenResponse;
      const tokenId = token.id ?? token.token;
      if (!tokenResponse.ok || !tokenId) throw new Error(token.message ?? "تعذر إنشاء رمز دفع آمن");
      const { data, error } = await getSupabase().functions.invoke("payment-create", {
        body: { order_id: orderId, source_token: tokenId, callback_url: `${window.location.origin}/payment-result?order=${orderId}` },
        headers: { "idempotency-key": crypto.randomUUID() },
      });
      if (error) throw new Error(error.message);
      return data as { transaction_url?: string; status: string };
    },
    onSuccess: (data) => {
      if (data.transaction_url) window.location.assign(data.transaction_url);
      else setMessage("قُبلت العملية، وننتظر تأكيد بوابة الدفع.");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر بدء الدفع"),
  });
  if (order.isLoading) return <LoadingPage label="نجهز صفحة الدفع…" />;
  if (order.error || !order.data) return <ErrorState message="الطلب غير موجود" />;
  return (
    <div className="payment-page">
      <PageHeader eyebrow="دفع آمن" title={`إتمام الطلب ${order.data.order_number}`} description={`القيمة ${Number(order.data.total).toFixed(2)} ر.س. بيانات البطاقة تذهب مباشرة إلى بوابة الدفع ولا تمر بخادم الكوفي.`} backTo="/orders" />
      <section className="payment-card">
        {!process.env.NEXT_PUBLIC_PAYMENT_PUBLIC_KEY ? (
          <EmptyState title="الدفع الإلكتروني غير مفعّل" description="تحتاج الإدارة إلى إضافة مفتاح البوابة العام والسر في الخادم. لم تتم محاكاة أي عملية." />
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); pay.mutate(); }} className="form-grid">
            <Field label="الاسم على البطاقة"><input dir="ltr" autoComplete="cc-name" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} required /></Field>
            <Field label="رقم البطاقة"><input dir="ltr" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} required /></Field>
            <Field label="شهر الانتهاء"><input dir="ltr" inputMode="numeric" autoComplete="cc-exp-month" value={card.month} onChange={(event) => setCard({ ...card, month: event.target.value })} required /></Field>
            <Field label="سنة الانتهاء"><input dir="ltr" inputMode="numeric" autoComplete="cc-exp-year" value={card.year} onChange={(event) => setCard({ ...card, year: event.target.value })} required /></Field>
            <Field label="رمز CVC"><input dir="ltr" type="password" inputMode="numeric" autoComplete="cc-csc" value={card.cvc} onChange={(event) => setCard({ ...card, cvc: event.target.value })} required /></Field>
            {message && <p className="form-message" role="status">{message}</p>}
            <Button type="submit" busy={pay.isPending}><CreditCard size={18} /> ادفع عبر البوابة</Button>
          </form>
        )}
      </section>
    </div>
  );
}

export function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const order = useQuery({
    queryKey: ["order", orderId],
    enabled: Boolean(orderId),
    refetchInterval: (query) => ["confirmed","payment_failed"].includes(String((query.state.data as Order | undefined)?.status)) ? false : 2500,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("orders").select("*").eq("id", orderId!).single();
      if (error) throw error;
      return data as Order;
    },
  });
  useEffect(() => {
    if (!orderId) return;
    const channel = getSupabase().channel(`payment-result:${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      }).subscribe();
    return () => { void getSupabase().removeChannel(channel); };
  }, [orderId, queryClient]);
  if (order.isLoading) return <LoadingPage label="ننتظر تأكيد بوابة الدفع…" />;
  const confirmed = order.data?.status === "confirmed" || order.data?.status === "paid";
  return (
    <section className="result-card">
      {confirmed ? <CheckCircle2 size={48} className="success-icon" /> : <Clock3 size={48} />}
      <h1>{confirmed ? "تم تأكيد الدفع" : order.data?.status === "payment_failed" ? "لم ينجح الدفع" : "نتحقق من الدفع"}</h1>
      <p>{confirmed ? "وصل تأكيد موثوق من البوابة وأُرسل الطلب للفرع." : "لا نعتمد على رابط الرجوع وحده؛ ننتظر Webhook الموثوق من المزود."}</p>
      <Button onClick={() => navigate(`/track/${orderId}`)}>متابعة الطلب</Button>
    </section>
  );
}

export function OrdersPage() {
  const { session } = useAuth();
  const orders = useQuery({
    queryKey: ["orders", session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("orders").select("id,order_number,branch_id,status,fulfillment_type,payment_method,total,created_at,arrival_confirmed_at").order("created_at", { ascending: false }).range(0, 29);
      if (error) throw error;
      return data as Order[];
    },
  });
  if (!session) return <EmptyState title="سجّل الدخول أولًا" description="طلباتك مرتبطة بحسابك وتحميها سياسات قاعدة البيانات." action={<Link className="button button--primary" to="/login">تسجيل الدخول</Link>} />;
  if (orders.isLoading) return <LoadingPage label="نحمّل طلباتك…" />;
  return (
    <div><PageHeader eyebrow="سجلك" title="طلباتي" description="آخر 30 طلبًا من بياناتك الحقيقية." />
      {orders.error ? <ErrorState onRetry={() => void orders.refetch()} /> : !orders.data?.length ? <EmptyState title="ما عندك طلبات للحين" description="أول طلب لك بيظهر هنا مباشرة." action={<Link className="button button--primary" to="/menu">اطلب الآن</Link>} /> :
        <div className="orders-list">{orders.data.map((order) => <Link key={order.id} to={`/track/${order.id}`}><div><small>{new Date(order.created_at).toLocaleString("ar-SA")}</small><h3>{order.order_number}</h3><span>{order.fulfillment_type === "car" ? "استلام من السيارة" : "استلام من الكوفي"}</span></div><div><StatusPill tone={order.status === "delivered" ? "success" : order.status.includes("failed") || order.status === "cancelled" ? "danger" : "info"}>{orderStatusAr[order.status]}</StatusPill><strong>{Number(order.total).toFixed(2)} ر.س</strong></div></Link>)}</div>}
    </div>
  );
}

export function TrackOrderPage() {
  const { orderId } = useParams();
  const queryClient = useQueryClient();
  const order = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await getSupabase().from("orders")
        .select("*,order_items(id,product_name_ar,quantity,customer_note,order_item_options(name_ar))")
        .eq("id", orderId!).single();
      if (error) throw error;
      return data as Order & { order_items: Array<{ id: string; product_name_ar: string; quantity: number; customer_note: string | null; order_item_options: Array<{ name_ar: string }> }> };
    },
  });
  useEffect(() => {
    const channel = getSupabase().channel(`order:${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      }).subscribe();
    return () => { void getSupabase().removeChannel(channel); };
  }, [orderId, queryClient]);
  const arrival = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().rpc("confirm_order_arrival", { p_order_id: orderId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["order", orderId] }),
  });
  if (order.isLoading) return <LoadingPage label="نتابع طلبك…" />;
  if (order.error || !order.data) return <ErrorState message="تعذر فتح الطلب" onRetry={() => void order.refetch()} />;
  const flow = ["confirmed","preparing","ready",order.data.fulfillment_type === "car" ? "out_for_delivery" : null,"delivered"].filter(Boolean) as string[];
  const currentIndex = flow.indexOf(order.data.status);
  return (
    <div><PageHeader eyebrow="تحديث لحظي" title={`طلب ${order.data.order_number}`} description="تتحدث الحالة تلقائيًا من الفرع." backTo="/orders" action={<StatusPill tone="info">{orderStatusAr[order.data.status]}</StatusPill>} />
      <div className="tracking-layout"><section className="tracking-card"><div className="tracking-steps">{flow.map((status, index) => <div className={index <= currentIndex ? "done" : ""} key={status}><span>{index < currentIndex ? <CheckCircle2 size={19} /> : index + 1}</span><strong>{orderStatusAr[status]}</strong></div>)}</div>
        {order.data.fulfillment_type === "car" && !order.data.arrival_confirmed_at && ["confirmed","preparing","ready"].includes(order.data.status) && <Button busy={arrival.isPending} onClick={() => arrival.mutate()}><Car size={18} /> أنا وصلت</Button>}
      </section>
      <section className="order-receipt"><h2>تفاصيل الطلب</h2>{order.data.order_items.map((item) => <div key={item.id}><span>{item.quantity} × {item.product_name_ar}<small>{item.order_item_options.map((option) => option.name_ar).join("، ")}</small></span></div>)}<hr /><p><span>الإجمالي</span><strong>{Number(order.data.total).toFixed(2)} ر.س</strong></p></section></div>
    </div>
  );
}
