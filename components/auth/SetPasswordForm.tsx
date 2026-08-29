"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { authClient } from "@/lib/auth/auth-client";

export function SetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");

    if (password !== confirm) {
      setLoading(false);
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setLoading(false);
      toast.error("Password must be at least 8 characters");
      return;
    }

    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword: password,
      revokeOtherSessions: true,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message ?? "Could not update password");
      return;
    }

    await fetch("/api/account/clear-must-change-password", { method: "POST" });

    toast.success("Password saved. Welcome to Impact Logistics!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="auth-muted text-sm leading-relaxed">
        Your administrator created your account with a temporary password. Enter
        that password below, then choose a new one.
      </p>
      <div>
        <label htmlFor="currentPassword" className="auth-label">
          Temporary password
        </label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          required
          autoComplete="current-password"
          placeholder="From your invite email"
        />
      </div>
      <div>
        <label htmlFor="password" className="auth-label">
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="auth-label">
          Confirm password
        </label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Repeat your password"
        />
      </div>
      <button type="submit" disabled={loading} className="auth-btn">
        {loading ? "Saving…" : "Save password and continue"}
      </button>
    </form>
  );
}
