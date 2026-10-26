import * as React from "react";

import { cn } from "@/lib/utils";

// Hairline rules between rows, a quiet header and a shade on hover.
function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />;
}

function TableBody({ className, ...props }) {
  return <tbody className={cn("[&_tr+tr]:border-t [&_tr+tr]:border-border", className)} {...props} />;
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
