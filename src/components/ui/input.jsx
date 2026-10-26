import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 shadow-field transition-[border-color,box-shadow] outline-none placeholder:text-gray-400 hover:border-gray-300 focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  );
}

export { Input };
