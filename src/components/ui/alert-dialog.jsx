"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function AlertDialog(props) {
  return <AlertDialogPrimitive.Root {...props} />;
}

function AlertDialogTrigger(props) {
  return <AlertDialogPrimitive.Trigger {...props} />;
}

function AlertDialogContent({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-gray-900/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <AlertDialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 rounded-xl bg-white p-6 shadow-paper-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogHeader({ className, ...props }) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

function AlertDialogTitle({ className, ...props }) {
  return <AlertDialogPrimitive.Title className={cn("text-lg font-semibold text-gray-900", className)} {...props} />;
}

function AlertDialogDescription({ className, ...props }) {
  return <AlertDialogPrimitive.Description className={cn("text-sm text-gray-600", className)} {...props} />;
}

function AlertDialogAction({ className, variant = "destructive", ...props }) {
  return <AlertDialogPrimitive.Action className={cn(buttonVariants({ variant }), className)} {...props} />;
}

function AlertDialogCancel({ className, ...props }) {
  return <AlertDialogPrimitive.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />;
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
