"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated");
    router.push("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <p className="auth-muted text-center py-4">Verifying reset link…</p>
    );
  }

  if (!ready) {
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
