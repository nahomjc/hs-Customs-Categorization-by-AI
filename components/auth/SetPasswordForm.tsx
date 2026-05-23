"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { createClient } from "@/lib/supabase/client";

export function SetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
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

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password saved. Welcome to Impact Logistics!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="auth-muted text-sm leading-relaxed">
        Your administrator created your account with a temporary password. Choose a
        new password you will use from now on.
      </p>
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
