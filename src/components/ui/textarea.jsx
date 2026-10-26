import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-900 transition-[background-color,box-shadow] outline-none placeholder:text-gray-500 hover:bg-gray-200/70 focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
