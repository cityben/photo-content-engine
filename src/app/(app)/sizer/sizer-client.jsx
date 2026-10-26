"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, ImagePlus, Loader2, RotateCcw, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { uploadPhoto } from "@/components/photo-uploader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client-api";
import { ALL_SIZES, cropRect, DEFAULT_SIZES, extendLayout, fileName, fitRect, keptShare, PLATFORMS, ratioLabel, safeArea, SETS, sizesInSet, subjectInside } from "@/lib/sizer";
import { EXTEND_MODELS } from "@/lib/sizer-models";
import { money } from "@/lib/ui-labels";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 40;
const FORMATS = [
  ["image/jpeg", "JPEG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"],
];
const FIT_BACKGROUNDS = [
  ["blur", "Blurred photo"],
  ["white", "White"],
  ["dark", "Dark"],
];

let nextId = 1;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = src;
  });
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const blobToBase64 = (blob) =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.readAsDataURL(blob);
  });

/**
 * Draw one size. `scale` < 1 for previews; 1 for the real file.
 * settings: { fx, fy, zoom, dx, dy, mode, fitBg, extended (Image) }
 */
function draw(canvas, img, size, s, scale = 1) {
  const cw = Math.max(1, Math.round(size.w * scale));
  const ch = Math.max(1, Math.round(size.h * scale));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (s.extended) {
    ctx.drawImage(s.extended, 0, 0, cw, ch);
    return;
  }
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (s.mode === "fit") {
    if (s.fitBg === "blur") {
      const r = cropRect(W, H, size.w, size.h, { fx: s.fx, fy: s.fy });
      ctx.filter = `blur(${Math.round(Math.max(cw, ch) / 30)}px)`;
      ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, -cw * 0.05, -ch * 0.05, cw * 1.1, ch * 1.1);
      ctx.filter = "none";
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.fillStyle = s.fitBg === "dark" ? "#111827" : "#ffffff";
      ctx.fillRect(0, 0, cw, ch);
    }
    const f = fitRect(W, H, cw, ch);
    ctx.drawImage(img, 0, 0, W, H, f.dx, f.dy, f.dw, f.dh);
    return;
  }
  const r = cropRect(W, H, size.w, size.h, s);
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, cw, ch);
}

/* --- Stage: the photo, its subject point and what survives every crop ------ */

function Stage({ photo, img, rects, hover, onFocal }) {
  const ref = useRef(null);
  if (!photo || !img) return null;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const safe = safeArea(rects.map((r) => r.rect));
  const pct = (v, total) => `${(v / total) * 100}%`;
  const set = (e) => {
    const box = ref.current.getBoundingClientRect();
    onFocal(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)));
  };
  return (
    <div className="flex flex-col gap-2">
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label="Click the subject of the photo to set the subject point. Arrow keys nudge it."
        onPointerDown={(e) => {
          set(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => e.buttons === 1 && set(e)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.05 : 0.01;
          const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          if (moves[e.key]) {
            e.preventDefault();
            onFocal(Math.min(1, Math.max(0, photo.fx + moves[e.key][0])), Math.min(1, Math.max(0, photo.fy + moves[e.key][1])));
          }
        }}
        className="relative mx-auto w-full max-w-3xl cursor-crosshair touch-none select-none overflow-hidden rounded-lg bg-gray-900 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        style={{ aspectRatio: `${W} / ${H}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a page image */}
        <img src={photo.url} alt="" className="absolute inset-0 size-full" draggable={false} />
        {safe ? (
          <>
            <div className="absolute inset-0 bg-black/55" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pct(safe.x, W)} ${pct(safe.y, H)}, ${pct(safe.x, W)} ${pct(safe.y + safe.h, H)}, ${pct(safe.x + safe.w, W)} ${pct(safe.y + safe.h, H)}, ${pct(safe.x + safe.w, W)} ${pct(safe.y, H)}, ${pct(safe.x, W)} ${pct(safe.y, H)})` }} />
            <div className="pointer-events-none absolute rounded-sm ring-2 ring-white" style={{ left: pct(safe.x, W), top: pct(safe.y, H), width: pct(safe.w, W), height: pct(safe.h, H) }} />
          </>
        ) : (
          rects.length > 0 && <div className="absolute inset-x-0 top-0 bg-destructive/90 px-3 py-1.5 text-xs text-white">No area survives every crop — some sizes have been panned apart.</div>
        )}
        {rects.map(({ size, rect }) => (
          <div
            key={size.id}
            className={cn("pointer-events-none absolute border border-dashed transition-opacity", hover === size.id ? "border-2 border-solid border-white opacity-100" : "border-white/40 opacity-60")}
            style={{ left: pct(rect.sx, W), top: pct(rect.sy, H), width: pct(rect.sw, W), height: pct(rect.sh, H) }}
          />
        ))}
        <div className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/60 shadow" style={{ left: pct(photo.fx, 1), top: pct(photo.fy, 1) }} />
      </div>
      <p className="text-center text-xs text-gray-600">
        Click the subject — the bright box is what every chosen size keeps. Dashed lines are each size&apos;s cut; hover a preview to see its one. {W}×{H}px.
      </p>
    </div>
  );
}

/* --- One output size -------------------------------------------------------- */

function Preview({ size, img, settings, onChange, onExtend, extending, aiModel, onDownload, onAddToJob, canAddToJob, onHover }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const rect = cropRect(W, H, size.w, size.h, settings);
  const kept = keptShare(W, H, rect);
  const cut = settings.mode === "crop" && !settings.extended && !subjectInside(W, H, rect, settings.fx, settings.fy);
  const scale = Math.min(1, 260 / size.w, 260 / size.h);

  useEffect(() => {
    if (ref.current) draw(ref.current, img, size, settings, scale);
  }, [img, size, settings, scale]);

  const panning = settings.mode === "crop" && !settings.extended;
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-xl bg-white p-3 shadow-paper" onMouseEnter={() => onHover(size.id)} onMouseLeave={() => onHover(null)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {size.platformLabel} · {size.label}
          </p>
          <p className="text-xs tabular-nums text-gray-500">
            {size.w}×{size.h} · {ratioLabel(size.w, size.h)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {settings.extended && <Badge>AI extended</Badge>}
          {cut && <Badge variant="destructive">Subject cut</Badge>}
          {panning && kept < 0.35 && <Badge variant="secondary">keeps {Math.round(kept * 100)}%</Badge>}
        </div>
      </div>
      <div className="flex min-h-40 items-center justify-center rounded-lg bg-gray-100 p-2">
        <canvas
          ref={ref}
          aria-label={`${size.platformLabel} ${size.label} preview${panning ? ", drag to reposition" : ""}`}
          className={cn("max-h-[260px] max-w-full rounded shadow-sm", panning && "cursor-grab touch-none active:cursor-grabbing")}
          onPointerDown={(e) => {
            if (!panning) return;
            drag.current = { x: e.clientX, y: e.clientY, dx: settings.dx || 0, dy: settings.dy || 0 };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const box = e.currentTarget.getBoundingClientRect();
            const k = rect.sw / box.width;
            onChange({ dx: drag.current.dx - (e.clientX - drag.current.x) * k, dy: drag.current.dy - (e.clientY - drag.current.y) * k });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-md bg-gray-100 p-0.5" role="group" aria-label="When the shape does not match">
          {[
            ["crop", "Crop"],
            ["fit", "Fit"],
          ].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={settings.mode === id && !settings.extended} onClick={() => onChange({ mode: id, extended: null })} className={cn("rounded px-2 py-0.5 text-xs font-medium", settings.mode === id && !settings.extended ? "bg-white shadow-paper" : "text-gray-600")}>
              {label}
            </button>
          ))}
        </div>
        {panning && (
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-gray-600">
            Zoom
            <input type="range" min={1} max={3} step={0.05} value={settings.zoom || 1} onChange={(e) => onChange({ zoom: Number(e.target.value) })} className="min-w-0 flex-1 accent-primary" aria-label={`Zoom for ${size.label}`} />
          </label>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onExtend} disabled={extending} title={`Generates the missing edges instead of cropping (${aiModel.label}, about ${money(aiModel.usd)})`}>
          {extending ? <Loader2 className="animate-spin" /> : <Sparkles />} Extend · {money(aiModel.usd)}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange({ zoom: 1, dx: 0, dy: 0, mode: null, extended: null })} aria-label={`Reset ${size.label}`}>
          <RotateCcw /> Reset
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onDownload} aria-label={`Download ${size.label}`}>
          <Download />
        </Button>
        {canAddToJob && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAddToJob} aria-label={`Add ${size.label} to the job's photos`}>
            <ImagePlus /> Job
          </Button>
        )}
      </div>
    </li>
  );
}

/* --- Page ------------------------------------------------------------------- */

export function SizerClient({ job, aiAvailable }) {
  const [photos, setPhotos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState(DEFAULT_SIZES);
  const [mode, setMode] = useState("crop");
  const [fitBg, setFitBg] = useState("blur");
  const [format, setFormat] = useState("image/jpeg");
  const [quality, setQuality] = useState(90);
  const [overrides, setOverrides] = useState({});
  const [aiModelId, setAiModelId] = useState(EXTEND_MODELS[0].id);
  const [aiPrompt, setAiPrompt] = useState("");
  const [hover, setHover] = useState(null);
  const [busy, setBusy] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const addPhoto = useCallback(async ({ src, name, sourceUrl }) => {
    const img = await loadImage(src);
    const id = `p${nextId++}`;
    setPhotos((list) => [...list, { id, name, url: src, img, sourceUrl: sourceUrl || null, fx: 0.5, fy: 0.5 }]);
    setActiveId((a) => a || id);
  }, []);

  const addFiles = async (files) => {
    const list = [...files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type)).slice(0, MAX_PHOTOS - photos.length);
    if (!list.length) return toast.error("Use JPG, PNG or WebP photos.");
    for (const f of list) {
      try {
        await addPhoto({ src: URL.createObjectURL(f), name: f.name });
      } catch (e) {
        toast.error(`${f.name}: ${e.message}`);
      }
    }
  };

  // Photos from a job (?job=…): loaded through this app so the canvas can export them.
  useEffect(() => {
    if (!job?.images?.length) return;
    let cancelled = false;
    (async () => {
      for (const [i, image] of job.images.slice(0, MAX_PHOTOS).entries()) {
        if (cancelled) return;
        const src = image.url.startsWith("/") ? image.url : `/api/sizer/source?url=${encodeURIComponent(image.url)}`;
        try {
          const res = await fetch(src);
          if (!res.ok) throw new Error();
          await addPhoto({ src: URL.createObjectURL(await res.blob()), name: `${job.title}-${i + 1}`, sourceUrl: image.url });
        } catch {
          toast.error(`Couldn't load photo ${i + 1} from the job.`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job, addPhoto]);

  const active = photos.find((p) => p.id === activeId) || null;
  const img = active?.img || null;
  const sizes = useMemo(() => ALL_SIZES.filter((s) => selected.includes(s.id)), [selected]);
  const aiModel = EXTEND_MODELS.find((m) => m.id === aiModelId);

  const settingsFor = (photo, size) => {
    const o = overrides[photo.id]?.[size.id] || {};
    return { fx: photo.fx, fy: photo.fy, zoom: o.zoom || 1, dx: o.dx || 0, dy: o.dy || 0, mode: o.mode || mode, fitBg, extended: o.extended || null };
  };
  const setOverride = (photoId, sizeId, patch) =>
    setOverrides((all) => ({ ...all, [photoId]: { ...all[photoId], [sizeId]: { ...all[photoId]?.[sizeId], ...patch } } }));

  const rects = active && img ? sizes.filter((s) => settingsFor(active, s).mode === "crop" && !settingsFor(active, s).extended).map((size) => ({ size, rect: cropRect(img.naturalWidth, img.naturalHeight, size.w, size.h, settingsFor(active, size)) })) : [];

  const render = async (photo, size) => {
    const canvas = document.createElement("canvas");
    draw(canvas, photo.img, size, settingsFor(photo, size), 1);
    return toBlob(canvas, format, format === "image/png" ? undefined : quality / 100);
  };

  const download = async (photo, size) => {
    const blob = await render(photo, size);
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: fileName(photo.name, size, format) });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const downloadAll = async () => {
    setBusy("zip");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const photo of photos) {
        for (const size of sizes) zip.file(fileName(photo.name, size, format), await render(photo, size));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "social-sizes.zip" });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast.success(`${photos.length * sizes.length} files ready.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const addToJob = async (photo, size) => {
    setBusy(`job:${size.id}`);
    try {
      const blob = await render(photo, size);
      const file = new File([blob], fileName(photo.name, size, "image/jpeg"), { type: blob.type });
      const image = await uploadPhoto(file);
      const { job: current } = await api(`/api/jobs/${job.id}`);
      await api(`/api/jobs/${job.id}`, { method: "PATCH", body: { images: [...(current.images || []), { ...image, alt: `${job.title} — ${size.platformLabel} ${size.label}` }] } });
      toast.success(`Added the ${size.platformLabel} ${size.label} cut to “${job.title}”.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const extend = async (photo, size) => {
    const key = `${photo.id}:${size.id}`;
    setBusy(`extend:${key}`);
    try {
      const source = photo.img;
      const L = extendLayout(source.naturalWidth, source.naturalHeight, size.w, size.h);
      const pic = Object.assign(document.createElement("canvas"), { width: L.canvas.w, height: L.canvas.h });
      const pctx = pic.getContext("2d");
      pctx.fillStyle = "#808080";
      pctx.fillRect(0, 0, L.canvas.w, L.canvas.h);
      pctx.drawImage(source, L.photo.x, L.photo.y, L.photo.w, L.photo.h);
      const mask = Object.assign(document.createElement("canvas"), { width: L.canvas.w, height: L.canvas.h });
      const mctx = mask.getContext("2d");
      mctx.fillStyle = "#000";
      // Opaque = keep; transparent = paint. Keep a few pixels in so the seam blends.
      mctx.fillRect(L.photo.x + 4, L.photo.y + 4, L.photo.w - 8, L.photo.h - 8);
      const [image, maskB64] = await Promise.all([toBlob(pic, "image/jpeg", 0.9).then(blobToBase64), toBlob(mask, "image/png").then(blobToBase64)]);
      const r = await api("/api/sizer/extend", { method: "POST", body: { image, mask: maskB64, size: `${L.canvas.w}x${L.canvas.h}`, model: aiModelId, prompt: aiPrompt || undefined } });
      const out = await loadImage(`data:${r.mediaType};base64,${r.image}`);
      // Cut the target-shaped region back out of the model's canvas.
      const k = out.naturalWidth / L.canvas.w;
      const frame = Object.assign(document.createElement("canvas"), { width: size.w, height: size.h });
      frame.getContext("2d").drawImage(out, L.region.x * k, L.region.y * k, L.region.w * k, L.region.h * k, 0, 0, size.w, size.h);
      const done = await loadImage(URL.createObjectURL(await toBlob(frame, "image/png")));
      setOverride(photo.id, size.id, { extended: done });
      toast.success(`Extended for ${size.platformLabel} ${size.label}. Check the edges before using it.`);
    } catch (e) {
      toast.error(`Couldn't extend: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-6">
      {/* Upload */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn("flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors", dragOver ? "border-primary bg-primary-soft" : "border-gray-200 bg-white")}
      >
        <Upload className="size-6 text-gray-400" />
        <p className="text-sm text-gray-700">Drop photos here, or</p>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}>
          Choose photos
        </Button>
        <p className="text-xs text-gray-500">JPG, PNG or WebP · up to {MAX_PHOTOS} photos · they stay in your browser{job ? ` · ${job.images.length} loaded from “${job.title}”` : ""}</p>
        <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {photos.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Photos">
          {photos.map((p) => (
            <li key={p.id} className="relative shrink-0">
              <button type="button" onClick={() => setActiveId(p.id)} aria-pressed={p.id === activeId} aria-label={`Edit ${p.name}`} className={cn("block size-20 overflow-hidden rounded-lg bg-gray-100 outline-none focus-visible:ring-[3px] focus-visible:ring-ring", p.id === activeId && "ring-[3px] ring-primary")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob thumbnail */}
                <img src={p.url} alt="" className="size-full object-cover" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => {
                  setPhotos((list) => list.filter((x) => x.id !== p.id));
                  setActiveId((a) => (a === p.id ? photos.find((x) => x.id !== p.id)?.id || null : a));
                }}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-1 text-gray-600 shadow-paper hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          {active && img ? (
            <section className="rounded-xl bg-white p-4 shadow-paper">
              <Stage photo={active} img={img} rects={rects} hover={hover} onFocal={(fx, fy) => setPhotos((list) => list.map((p) => (p.id === active.id ? { ...p, fx, fy } : p)))} />
            </section>
          ) : (
            <p className="rounded-xl bg-white p-10 text-center text-sm text-gray-600 shadow-paper">Add a photo to see every size it will come out as.</p>
          )}
          {active && img && (
            <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Sizes">
              {sizes.map((size) => (
                <Preview
                  key={`${active.id}-${size.id}`}
                  size={size}
                  img={img}
                  settings={settingsFor(active, size)}
                  onChange={(patch) => setOverride(active.id, size.id, patch)}
                  onExtend={() => (aiAvailable ? extend(active, size) : toast.error("Connect the AI Gateway to use AI extend."))}
                  extending={busy === `extend:${active.id}:${size.id}`}
                  aiModel={aiModel}
                  onDownload={() => download(active, size)}
                  onAddToJob={() => addToJob(active, size)}
                  canAddToJob={Boolean(job)}
                  onHover={setHover}
                />
              ))}
              {!sizes.length && <li className="text-sm text-gray-600">Pick some sizes.</li>}
            </ul>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-paper" aria-label="Export">
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Photos", photos.length],
                ["Sizes each", sizes.length],
                ["Files out", photos.length * sizes.length],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-gray-50 p-2">
                  <dt className="text-[11px] text-gray-500">{l}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-gray-900">{v}</dd>
                </div>
              ))}
            </dl>
            <Button onClick={downloadAll} disabled={!photos.length || !sizes.length || busy === "zip"}>
              {busy === "zip" ? <Loader2 className="animate-spin" /> : <Download />} Download all (ZIP)
            </Button>
          </section>
          <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-paper" aria-labelledby="sizes-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="sizes-title" className="text-sm font-semibold text-gray-900">
                Sizes
              </h2>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(DEFAULT_SIZES)}>
                Reset
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SETS).map(([id, s]) => (
                <Button key={id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(sizesInSet(id))}>
                  {s.label}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(sizesInSet("all"))}>
                All
              </Button>
            </div>
            <p className="text-xs text-gray-500">Sizes within a set share a shape, so one crop suits them all.</p>
            {PLATFORMS.map((p) => (
              <fieldset key={p.id} className="flex flex-col gap-1.5">
                <legend className="mb-1 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-600">
                  {p.label}
                  <span className="font-normal normal-case tabular-nums text-gray-500">
                    {p.sizes.filter((s) => selected.includes(s.id)).length}/{p.sizes.length}
                  </span>
                </legend>
                {p.sizes.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-gray-50">
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="mt-0.5 size-4 accent-primary" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex justify-between gap-2 text-sm text-gray-900">
                        {s.label} <span className="text-xs tabular-nums text-gray-500">{ratioLabel(s.w, s.h)}</span>
                      </span>
                      <span className="text-xs text-gray-500">
                        {s.note} · {s.w}×{s.h}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))}
          </section>

          <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-paper" aria-labelledby="output-title">
            <h2 id="output-title" className="text-sm font-semibold text-gray-900">
              Output
            </h2>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-700">When the shape does not match</span>
              <div className="inline-flex w-fit gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="When the shape does not match">
                {[
                  ["crop", "Crop"],
                  ["fit", "Fit whole photo"],
                ].map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={cn("rounded-md px-3 py-1 text-sm font-medium", mode === id ? "bg-white shadow-paper" : "text-gray-600")}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{mode === "crop" ? "Fills the frame, cutting the edges around the subject point." : "Keeps the whole photo, filling the gaps with the background below."}</p>
              {mode === "fit" && (
                <select value={fitBg} onChange={(e) => setFitBg(e.target.value)} aria-label="Fit background" className="h-9 w-fit rounded-md bg-gray-100 px-3 text-sm">
                  {FIT_BACKGROUNDS.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-700">Format</span>
                <div className="inline-flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Output format">
                  {FORMATS.map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={format === id} onClick={() => setFormat(id)} className={cn("rounded-md px-2.5 py-1 text-sm font-medium", format === id ? "bg-white shadow-paper" : "text-gray-600")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {format !== "image/png" && (
                <label className="flex flex-col gap-1.5 text-xs font-medium text-gray-700">
                  Quality {quality}
                  <input type="range" min={60} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-32 accent-primary" aria-label="Quality" />
                </label>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-paper" aria-labelledby="ai-title">
            <h2 id="ai-title" className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <Wand2 className="size-4 text-primary" /> AI extend
            </h2>
            <p className="text-xs text-gray-600">Used only when you click Extend on a preview. Generates the missing edges instead of cropping — one call per shape, through your AI Gateway.</p>
            <select value={aiModelId} onChange={(e) => setAiModelId(e.target.value)} aria-label="Image model" className="h-9 rounded-md bg-gray-100 px-3 text-sm" disabled={!aiAvailable}>
              {EXTEND_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — ~{money(m.usd)} a shape
                </option>
              ))}
            </select>
            {aiModel && <p className="text-xs text-gray-500">{aiModel.note}</p>}
            <div className="flex flex-col gap-1">
              <Label htmlFor="ai-prompt" className="text-xs">
                Add to the prompt (optional)
              </Label>
              <Input id="ai-prompt" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. keep the van fully in shot" disabled={!aiAvailable} />
            </div>
            {!aiAvailable && (
              <p className="flex items-start gap-1.5 text-xs text-gray-600">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Connect the AI Gateway to use it.
              </p>
            )}
          </section>

        </aside>
      </div>
    </div>
  );
}
