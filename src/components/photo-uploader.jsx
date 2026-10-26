"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, GripVertical, ImagePlus, Loader2, X } from "lucide-react";

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

export async function uploadPhoto(file) {
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

function SortablePhoto({ image, index, isMain, onMakeMain, onRemove, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.url,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex flex-col gap-1.5", isDragging && "z-10 opacity-80")}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Photo ${index + 1}${isMain ? ", main building photo" : ""}. Press space to pick up, arrows to move.`}
        className={cn(
          "group relative aspect-square cursor-grab touch-none overflow-hidden rounded-lg bg-gray-100 outline-none focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing",
          isMain && "ring-[3px] ring-primary",
          isDragging && "shadow-paper-lg"
        )}
      >
        <Image src={image.url} alt="" fill unoptimized sizes="200px" className="pointer-events-none object-cover" draggable={false} />
        <span className="absolute top-2 left-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-700 shadow-paper">{index + 1}</span>
        {isMain && (
          <span className="absolute right-2 bottom-2 left-2 inline-flex items-center justify-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
            <Building2 className="size-3" /> Main photo
          </span>
        )}
        <GripVertical className="absolute top-2 right-2 size-5 rounded bg-white/90 p-0.5 text-gray-500 opacity-0 shadow-paper transition-opacity group-hover:opacity-100" />
      </div>
      <div className="flex items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={disabled || isMain}
          onClick={onMakeMain}
          aria-label={`Make photo ${index + 1} the main building photo`}
        >
          <Building2 /> {isMain ? "Main" : "Make main"}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={onRemove} aria-label={`Remove photo ${index + 1}`}>
          <X />
        </Button>
      </div>
    </li>
  );
}

/**
 * Upload, reorder (drag, touch or keyboard) and choose the main building
 * photo — the case study's hero and card image, and the lead photo on posts.
 * `mainUrl` defaults to the first photo.
 */
export function PhotoUploader({ images, onChange, mainUrl, onMainChange, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const main = images.some((i) => i.url === mainUrl) ? mainUrl : images[0]?.url;

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
        const image = await uploadPhoto(file);
        current = [...current, image];
        onChange(current);
      } catch (e) {
        setError(e.message);
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = images.findIndex((i) => i.url === active.id);
    const to = images.findIndex((i) => i.url === over.id);
    onChange(arrayMove(images, from, to));
  };

  const remove = (url) => {
    const next = images.filter((i) => i.url !== url);
    onChange(next);
    if (url === main && onMainChange) onMainChange(next[0]?.url || null);
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
            or <span className="font-medium text-primary group-hover:underline">browse</span> — up to {MAX_PHOTOS}, JPG/PNG/WebP.
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
        <>
          <p className="text-xs text-gray-500">
            Drag photos to reorder (or focus one and use space + arrow keys). <span className="font-medium text-gray-700">Main photo</span> = the building shot used as the case study hero and on cards.
          </p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={images.map((i) => i.url)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((img, i) => (
                  <SortablePhoto
                    key={img.url}
                    image={img}
                    index={i}
                    isMain={img.url === main}
                    disabled={busy}
                    onMakeMain={() => onMainChange?.(img.url)}
                    onRemove={() => remove(img.url)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}
