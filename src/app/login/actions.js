"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { safeCallback } from "@/lib/redirects";

export async function signInWithPassword(_prevState, formData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeCallback(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "That email and password don't match. After 5 wrong attempts, sign-in is paused for 15 minutes."
            : "Sign-in failed. Try again.",
        email: String(formData.get("email") ?? ""),
      };
    }
    // Successful sign-in throws Next's redirect; let it through.
    throw error;
  }
  return null;
}

export async function signInWithMicrosoft(formData) {
  await signIn("microsoft-entra-id", {
    redirectTo: safeCallback(formData.get("callbackUrl")),
  });
}
