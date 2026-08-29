"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth-client";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!token) {
      toast.error("Reset link is invalid or expired");
      return;
    }

    setLoading(true);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");

    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message ?? "Could not reset password");
      return;
    }

    toast.success("Password updated");
    router.push("/dashboard");
    router.refresh();
  }

  if (!token) {
    return (
      <div className="space-y-5 text-center">
        <p className="auth-muted leading-relaxed">
          This reset link is invalid or expired. Request a new one.
        </p>
        <Link href="/forgot-password" className="inline-block auth-link text-sm">
          Request new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="password" className="auth-label">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="auth-input"
          placeholder="At least 8 characters"
        />
      </div>
      <button type="submit" disabled={loading} className="auth-btn">
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
