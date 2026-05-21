"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  const authError = searchParams.get("error");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authError) {
      toast.error(decodeURIComponent(authError));
    }
  }, [authError]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Signed in successfully");
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="auth-label mb-0">
            Password
          </label>
          <Link href="/forgot-password" className="text-sm auth-link">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          required
          autoComplete="current-password"
          minLength={6}
          placeholder="••••••••"
        />
      </div>
      <button type="submit" disabled={loading} className="auth-btn">
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center auth-muted">
        No account?{" "}
        <Link href="/signup" className="auth-link">
          Create one
        </Link>
      </p>
    </form>
  );
}
