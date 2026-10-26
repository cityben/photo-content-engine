import * as React from "react";

import { cn } from "@/lib/utils";

// Rows separate by shade on hover and a 1px gray-100 band — no drawn borders.
function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return <thead className={cn("bg-gray-50", className)} {...props} />;
}

function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr+tr]:shadow-[0_-1px_0_var(--color-gray-100)]", className)} {...props} />;
}

function TableRow({ className, ...props }) {
  return <tr className={cn("transition-colors hover:bg-gray-50/70", className)} {...props} />;
}

function TableHead({ className, ...props }) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-gray-500 first:rounded-l-md last:rounded-r-md",
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }) {
  return <td className={cn("px-3 py-2.5 align-middle text-gray-700", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
