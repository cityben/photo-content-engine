"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
// Keeps uploads well under Vercel's 4.5MB request body limit.
const MAX_EDGE = 1600;

/**
 * Downscale in the browser and re-encode as JPEG, so a 12MP phone photo
 * becomes a few hundred KB before it is sent.
 */
async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.85),
    width: canvas.width,
    height: canvas.height,
  };
}

export function PhotoDropzone({ photo, onChange, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      setError(null);
      if (!ACCEPTED.includes(file.type)) {
        setError("Use a JPG, PNG or WebP photo. iPhone HEIC files need exporting as JPG first.");
        return;
      }
      if (file.size > MAX_INPUT_BYTES) {
        setError("That file is over 20MB. Pick a smaller photo.");
        return;
      }
      setPreparing(true);
      try {
        const prepared = await prepareImage(file);
        onChange({ ...prepared, name: file.name });
      } catch {
        setError("Couldn't read that image. Try another file.");
      } finally {
        setPreparing(false);
      }
    },
    [onChange]
  );

  const openPicker = () => inputRef.current?.click();

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFile(event.dataTransfer.files?.[0]);
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED.join(",")}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        handleFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (photo) {
    return (
      <div className="flex flex-col gap-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={photo.dataUrl}
            alt={`Uploaded job photo: ${photo.name}`}
            fill
            unoptimized
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="truncate text-sm text-gray-600">
            {photo.name}
            <span className="text-gray-500"> · {photo.width}×{photo.height}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={openPicker} disabled={disabled}>
              <RefreshCw /> Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange(null)} disabled={disabled}>
              <X /> Remove
            </Button>
          </div>
        </div>
        {input}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled || preparing}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group flex min-h-72 w-full flex-1 flex-col items-center justify-center gap-4 rounded-lg bg-gray-100 px-6 py-12 text-center transition-[background-color,box-shadow] outline-none hover:bg-gray-200/60 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-80",
          dragging && "bg-primary-soft ring-[3px] ring-ring"
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-white text-primary shadow-paper transition-transform group-hover:scale-105">
          {preparing ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
        </span>
        <span className="flex flex-col gap-1">
          <span className="text-base font-semibold text-gray-900">
            {dragging ? "Drop to upload" : "Drop a job photo here"}
          </span>
          <span className="text-sm text-gray-600">
            or <span className="font-medium text-primary underline-offset-4 group-hover:underline">browse your files</span>
            {" "}— JPG, PNG or WebP
          </span>
        </span>
      </button>
      {error && (
        <p role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {input}
    </div>
  );
}
