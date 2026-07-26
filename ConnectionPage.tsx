"use client";
/* eslint-disable @next/next/no-img-element -- Sticker URLs come from the configured Supabase Storage project. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  FlipHorizontal2,
  ImagePlus,
  Palette,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Canvas as FabricCanvas, FabricObject } from "fabric";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/Providers";
import { Button, EmptyState, ErrorState, LoadingPage, PageHeader, StatusPill } from "@/components/ui";
import { getSupabase, publicAssetUrl } from "@/lib/supabase";

type EditorElement = {
  type: "sticker" | "customer_asset" | "text";
  sticker_id?: string;
  customer_asset_id?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale_x: number;
  scale_y: number;
  z_index: number;
  opacity: number;
  flip_x: boolean;
  flip_y: boolean;
};

function intersectsProtected(canvas: FabricCanvas, object: FabricObject) {
  return canvas.getObjects().some((zone) =>
    (zone as FabricObject & { data?: { protected?: boolean } }).data?.protected &&
    object.intersectsWithObject(zone)
  );
}

export function CardEditorPage() {
  const auth = useAuth();
  const canvasElement = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<FabricCanvas | null>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const safePosition = useRef(new WeakMap<FabricObject, { left: number; top: number }>());
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [designName, setDesignName] = useState("بطاقتي");
  const [historyPosition, setHistoryPosition] = useState({ index: -1, length: 0 });
  const queryClient = useQueryClient();

  const stickers = useQuery({
    queryKey: ["stickers-editor"],
    enabled: Boolean(auth.session),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("stickers")
        .select("id,name_ar,asset_path,category_id")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
  const designs = useQuery({
    queryKey: ["card-designs"],
    enabled: Boolean(auth.session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("card_designs")
        .select("id,name,is_active,active_version_id,updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!canvasElement.current || !auth.session) return;
    let disposed = false;
    void import("fabric").then(({ Canvas, Rect, FabricText }) => {
      if (disposed || !canvasElement.current) return;
      const canvas = new Canvas(canvasElement.current, {
        width: 720,
        height: 420,
        backgroundColor: "#6f3f26",
        preserveObjectStacking: true,
        selectionColor: "rgba(229,174,96,.15)",
      });
      canvasRef.current = canvas;
      const protectedZones = [
        { left: 468, top: 21, width: 216, height: 176, label: "QR" },
        { left: 36, top: 21, width: 396, height: 84, label: "الهوية" },
        { left: 36, top: 269, width: 648, height: 126, label: "الأكواب" },
      ];
      for (const zone of protectedZones) {
        const rect = new Rect({
          ...zone,
          fill: "rgba(255,255,255,.08)",
          stroke: "rgba(255,255,255,.30)",
          strokeDashArray: [8, 6],
          selectable: false,
          evented: false,
          rx: 16,
          ry: 16,
        });
        (rect as FabricObject & { data?: unknown }).data = { protected: true };
        canvas.add(rect);
        const label = new FabricText(zone.label, {
          left: zone.left + 12,
          top: zone.top + 10,
          fontSize: 14,
          fill: "rgba(255,255,255,.68)",
          selectable: false,
          evented: false,
        });
        (label as FabricObject & { data?: unknown }).data = { protected: true };
        canvas.add(label);
      }
      const snapshot = () => {
        const json = JSON.stringify((canvas as FabricCanvas & {
          toJSON: (propertiesToInclude?: string[]) => unknown;
        }).toJSON(["data"]));
        history.current = history.current.slice(0, historyIndex.current + 1);
        history.current.push(json);
        historyIndex.current = history.current.length - 1;
        setHistoryPosition({ index: historyIndex.current, length: history.current.length });
      };
      snapshot();
      canvas.on("object:added", ({ target }) => {
        if (!(target as FabricObject & { data?: { protected?: boolean } }).data?.protected) {
          safePosition.current.set(target, { left: target.left, top: target.top });
        }
      });
      canvas.on("object:moving", ({ target }) => {
        if (!intersectsProtected(canvas, target)) {
          safePosition.current.set(target, { left: target.left, top: target.top });
        } else {
          const safe = safePosition.current.get(target);
          if (safe) target.set(safe);
          setMessage("منطقة QR والهوية والأكواب محمية من التغطية.");
        }
      });
      canvas.on("object:modified", ({ target }) => {
        if (intersectsProtected(canvas, target)) {
          const safe = safePosition.current.get(target);
          if (safe) target.set(safe);
          canvas.requestRenderAll();
          setMessage("تعذر وضع العنصر فوق منطقة محمية.");
        } else snapshot();
      });
      canvas.on("object:removed", snapshot);
      setReady(true);
    });
    return () => {
      disposed = true;
      canvasRef.current?.dispose();
      canvasRef.current = null;
    };
  }, [auth.session]);

  async function addSticker(sticker: { id: string; asset_path: string }) {
    if (!canvasRef.current) return;
    const { FabricImage } = await import("fabric");
    const url = publicAssetUrl("sticker-assets", sticker.asset_path);
    if (!url) return;
    const image = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
    image.set({ left: 250, top: 125, scaleX: 0.25, scaleY: 0.25 });
    (image as FabricObject & { data?: unknown }).data = { kind: "sticker", sticker_id: sticker.id };
    canvasRef.current.add(image);
    canvasRef.current.setActiveObject(image);
    canvasRef.current.requestRenderAll();
  }

  async function addText() {
    if (!canvasRef.current) return;
    const { FabricText } = await import("fabric");
    const text = new FabricText("قهوتي على مزاجي", {
      left: 250,
      top: 150,
      fill: "#fff7e8",
      fontSize: 26,
      fontFamily: "Arial",
    });
    (text as FabricObject & { data?: unknown }).data = { kind: "text" };
    canvasRef.current.add(text);
    canvasRef.current.setActiveObject(text);
  }

  function selectedAction(action: "delete" | "copy" | "flip" | "front" | "back") {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active || (active as FabricObject & { data?: { protected?: boolean } }).data?.protected) return;
    if (action === "delete") canvas.remove(active);
    if (action === "flip") active.set({ flipX: !active.flipX });
    if (action === "front") canvas.bringObjectForward(active);
    if (action === "back") canvas.sendObjectBackwards(active);
    if (action === "copy") {
      void active.clone().then((clone) => {
        clone.set({ left: active.left + 18, top: active.top + 18 });
        canvas.add(clone);
        canvas.setActiveObject(clone);
        canvas.requestRenderAll();
      });
    }
    canvas.requestRenderAll();
  }

  async function loadHistory(index: number) {
    const canvas = canvasRef.current;
    const snapshot = history.current[index];
    if (!canvas || !snapshot) return;
    historyIndex.current = index;
    await canvas.loadFromJSON(snapshot);
    canvas.requestRenderAll();
    setHistoryPosition({ index, length: history.current.length });
  }

  function serialize(): EditorElement[] {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    return canvas.getObjects().flatMap((object, index) => {
      const metadata = (object as FabricObject & {
        data?: { protected?: boolean; kind?: string; sticker_id?: string; customer_asset_id?: string };
        text?: string;
      }).data;
      if (metadata?.protected) return [];
      const kind = metadata?.kind === "text" ? "text" : metadata?.kind === "customer_asset" ? "customer_asset" : "sticker";
      return [{
        type: kind,
        sticker_id: metadata?.sticker_id,
        customer_asset_id: metadata?.customer_asset_id,
        text: kind === "text" ? (object as FabricObject & { text?: string }).text : undefined,
        x: object.left,
        y: object.top,
        width: object.width,
        height: object.height,
        rotation: object.angle,
        scale_x: object.scaleX,
        scale_y: object.scaleY,
        z_index: index,
        opacity: object.opacity,
        flip_x: object.flipX,
        flip_y: object.flipY,
      } satisfies EditorElement];
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().functions.invoke("validate-card-design", {
        body: {
          design_id: null,
          name: designName,
          canvas_width: 720,
          canvas_height: 420,
          elements: serialize(),
          background: { color: "#6f3f26" },
          make_active: true,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setMessage("تم حفظ التصميم والتحقق من المناطق المحمية في الخادم.");
      void queryClient.invalidateQueries({ queryKey: ["card-designs"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر حفظ التصميم"),
  });

  async function applyDesign(id: string) {
    await getSupabase().from("card_designs").update({ is_active: true }).eq("id", id);
    await getSupabase().from("card_designs").update({ is_active: false }).neq("id", id);
    setMessage("تم تطبيق التصميم المحفوظ.");
    void designs.refetch();
  }

  if (auth.loading) return <LoadingPage />;
  if (!auth.session) return <EmptyState title="سجّل الدخول لتزيين بطاقتك" description="التصميم يُحفظ في حسابك داخل Supabase." />;
  return (
    <div className="editor-page">
      <PageHeader eyebrow="ميزة أساسية" title="زيّن بطاقتك" description="اسحب، كبّر ودوّر باللمس. المناطق المتقطعة محمية في الواجهة والخادم." backTo="/loyalty" />
      <div className="editor-layout">
        <aside className="sticker-panel">
          <div className="sticker-panel__title"><Palette size={20} /><h2>مكتبة الملصقات</h2></div>
          {stickers.isLoading ? <LoadingPage label="نحمّل الملصقات…" /> : stickers.error ? <ErrorState /> : !stickers.data?.length ? <EmptyState title="المكتبة فارغة" description="يرفع الموظف المصرح الملصقات التي يملك حقوقها." /> :
            <div className="sticker-grid">{stickers.data.map((sticker) => {
              const url = publicAssetUrl("sticker-assets", sticker.asset_path);
              return <button key={sticker.id} onClick={() => void addSticker(sticker)}>{url ? <img src={url} alt={sticker.name_ar} /> : <ImagePlus size={25} />}<span>{sticker.name_ar}</span></button>;
            })}</div>}
          <Link className="button button--secondary" to="/assets"><ImagePlus size={17} /> صوري الخاصة</Link>
        </aside>

        <section className="canvas-panel">
          <div className="editor-toolbar">
            <button onClick={() => void addText()}><Type size={18} /><span>نص</span></button>
            <button onClick={() => selectedAction("copy")}><Copy size={18} /><span>نسخ</span></button>
            <button onClick={() => selectedAction("flip")}><FlipHorizontal2 size={18} /><span>قلب</span></button>
            <button onClick={() => selectedAction("front")}><ArrowUpToLine size={18} /><span>للأمام</span></button>
            <button onClick={() => selectedAction("back")}><ArrowDownToLine size={18} /><span>للخلف</span></button>
            <button onClick={() => void loadHistory(historyPosition.index - 1)} disabled={historyPosition.index <= 0}><Undo2 size={18} /><span>تراجع</span></button>
            <button onClick={() => void loadHistory(historyPosition.index + 1)} disabled={historyPosition.index >= historyPosition.length - 1}><Redo2 size={18} /><span>إعادة</span></button>
            <button onClick={() => selectedAction("delete")}><Trash2 size={18} /><span>حذف</span></button>
            <button onClick={() => void loadHistory(0)}><RotateCcw size={18} /><span>الأصل</span></button>
          </div>
          <div className="canvas-wrap"><canvas ref={canvasElement} /></div>
          {!ready && <LoadingPage label="نجهز المحرر…" />}
          {message && <p className="form-message" role="status">{message}</p>}
          <div className="editor-save"><input value={designName} onChange={(event) => setDesignName(event.target.value)} aria-label="اسم التصميم" /><Button busy={save.isPending} onClick={() => save.mutate()}><Save size={18} /> حفظ نسخة جديدة</Button></div>
        </section>

        <aside className="saved-designs">
          <h2>تصاميمي</h2>
          {!designs.data?.length ? <p>لا توجد تصاميم محفوظة.</p> : designs.data.map((design) => <article key={design.id}><div><strong>{design.name}</strong><small>{new Date(design.updated_at).toLocaleDateString("ar-SA")}</small></div>{design.is_active ? <StatusPill tone="success">مطبق</StatusPill> : <Button variant="ghost" onClick={() => void applyDesign(design.id)}>تطبيق</Button>}</article>)}
        </aside>
      </div>
    </div>
  );
}
