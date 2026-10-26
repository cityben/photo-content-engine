import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-900 transition-[background-color,box-shadow] outline-none placeholder:text-gray-500 hover:bg-gray-200/70 focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-[3px] aria-invalid:ring-destructive/25",
        className
      )}
      {...props}
    />
  );
}

export { Input };
