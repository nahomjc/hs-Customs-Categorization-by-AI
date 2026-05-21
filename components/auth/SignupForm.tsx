"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getRedirectOrigin } from "@/lib/auth/redirect-origin";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentTo, setSentTo] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();

    const origin = getRedirectOrigin();
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
        data: {
          full_name: fullName || undefined,
          name: fullName || undefined,
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data.session) {
      toast.success("Account created. Welcome!");
      window.location.href = "/dashboard";
      return;
    }

    setSentTo(email);
    setEmailSent(true);
    toast.success("Check your email to confirm your account");
  }

  if (emailSent) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-[#007bff]/10 flex items-center justify-center text-[#007bff]">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="auth-muted leading-relaxed">
          We sent a confirmation link to{" "}
          <span className="font-medium text-gray-900">{sentTo}</span>. Open it to
          activate your account.
        </p>
        <Link href="/login" className="inline-block auth-link text-sm">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="fullName" className="auth-label">
          Full name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          className="auth-input"
          placeholder="Your name"
        />
      </div>
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
        <label htmlFor="password" className="auth-label">
          Password
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
        {loading ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center auth-muted">
        Already have an account?{" "}
        <Link href="/login" className="auth-link">
          Sign in
        </Link>
      </p>
    </form>
  );
}
