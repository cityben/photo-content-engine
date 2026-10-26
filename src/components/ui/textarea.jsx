import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-gray-900 shadow-field transition-[border-color,box-shadow] outline-none placeholder:text-gray-400 hover:border-gray-300 focus-visible:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60 leading-6",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
