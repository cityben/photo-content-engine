"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_EDGE = 2048;
const MAX_PHOTOS = 10;

/** Downscale and re-encode in the browser so each upload is a few hundred KB. */
async function prepare(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  return { blob, width: canvas.width, height: canvas.height };
}

async function upload(file) {
  const { blob, width, height } = await prepare(file);
  const form = new FormData();
  form.append("file", blob, "photo.jpg");
  form.append("width", String(width));
  form.append("height", String(height));
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
  return body.image;
}

export function PhotoUploader({ images, onChange, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState(null);

  const addFiles = async (fileList) => {
    setError(null);
    const files = [...fileList].filter((f) => ACCEPTED.includes(f.type));
    if (files.length < fileList.length) {
      setError("Some files were skipped. Use JPG, PNG or WebP — export iPhone HEIC photos as JPG.");
    }
    const room = MAX_PHOTOS - images.length;
    if (files.length > room) setError(`Up to ${MAX_PHOTOS} photos per job.`);
    const batch = files.slice(0, Math.max(0, room));
    if (!batch.length) return;

    setPending((n) => n + batch.length);
    let current = images;
    for (const file of batch) {
      try {
        const image = await upload(file);
        current = [...current, image];
        onChange(current);
      } catch (e) {
        setError(e.message);
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const move = (i, dir) => {
    const next = [...images];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item);
    onChange(next);
  };

  const busy = disabled || pending > 0;

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || images.length >= MAX_PHOTOS}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group flex w-full flex-col items-center justify-center gap-3 rounded-lg bg-gray-100 px-6 text-center transition-[background-color,box-shadow] outline-none hover:bg-gray-200/60 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          images.length ? "py-8" : "min-h-64 py-12",
          dragging && "bg-primary-soft ring-[3px] ring-ring"
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-white text-primary shadow-paper transition-transform group-hover:scale-105">
          {pending ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-gray-900">
            {pending ? `Uploading ${pending} photo${pending === 1 ? "" : "s"}…` : dragging ? "Drop to upload" : images.length ? "Add more photos" : "Drop job photos here"}
          </span>
          <span className="text-xs text-gray-600">
            or <span className="font-medium text-primary group-hover:underline">browse</span> — up to {MAX_PHOTOS}, JPG/PNG/WebP. Best shot first.
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.url} className="flex flex-col gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                <Image src={img.url} alt={`Photo ${i + 1}`} fill unoptimized sizes="200px" className="object-cover" />
                {i === 0 && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-gray-800 shadow-paper">
                    <Star className="size-3 fill-marker text-marker" /> Cover
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">
                    <ArrowLeft />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={busy || i === images.length - 1} onClick={() => move(i, 1)} aria-label="Move later">
                    <ArrowRight />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  onClick={() => onChange(images.filter((_, j) => j !== i))}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
