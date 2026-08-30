"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getAuthErrorMessage } from "@/lib/auth/auth-error-message";
import { authClient } from "@/lib/auth/auth-client";
import { getRedirectOrigin } from "@/lib/auth/redirect-origin";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    const origin = getRedirectOrigin();

    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      toast.error(getAuthErrorMessage({ message: error.message, status: error.status }));
      return;
    }

    setSent(true);
    toast.success("Password reset email sent");
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-[#007bff]/10 flex items-center justify-center text-[#007bff]">
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="auth-muted leading-relaxed">
          If an account exists for that email, you will receive a reset link
          shortly.
        </p>
        <Link href="/login" className="inline-block auth-link text-sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="auth-muted -mt-1">
        Enter your email and we will send you a link to reset your password.
      </p>
      <div>
        <label htmlFor="email" className="auth-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="auth-input"
          placeholder="you@company.com"
        />
      </div>
      <button type="submit" disabled={loading} className="auth-btn">
        {loading ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center auth-muted">
        <Link href="/login" className="auth-link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
