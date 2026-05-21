"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const fieldClass =
  "w-full py-2.5 px-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12";

const VOLUME_OPTIONS = [
  { value: "", label: "Select volume (optional)" },
  { value: "under_50", label: "Under 50 shipments / month" },
  { value: "50_200", label: "50 – 200 shipments / month" },
  { value: "200_plus", label: "200+ shipments / month" },
] as const;

export function DemoRequestForm() {
  const searchParams = useSearchParams();
  const source = searchParams.get("source") ?? "landing";
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      company: String(form.get("company") ?? ""),
      phone: String(form.get("phone") ?? ""),
      jobTitle: String(form.get("jobTitle") ?? ""),
      monthlyVolume: String(form.get("monthlyVolume") ?? ""),
      message: String(form.get("message") ?? ""),
      source,
    };

    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmitted(true);
      toast.success("Request received — we'll be in touch soon.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="landing-float-card bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-10 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-5">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <title>Success</title>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Thank you!</h2>
        <p className="mt-2 text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">
          We received your demo request. Our team will contact you within one
          business day to schedule a walkthrough of Impact Logistics.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#007bff] text-white text-sm font-semibold hover:bg-[#0069d9] transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="landing-float-card bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 space-y-5"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="demo-fullName" className="auth-label">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="demo-fullName"
            name="fullName"
            type="text"
            required
            autoComplete="name"
            className={fieldClass}
            placeholder="Jane Doe"
          />
        </div>
        <div>
          <label htmlFor="demo-email" className="auth-label">
            Work email <span className="text-red-500">*</span>
          </label>
          <input
            id="demo-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={fieldClass}
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor="demo-company" className="auth-label">
            Company <span className="text-red-500">*</span>
          </label>
          <input
            id="demo-company"
            name="company"
            type="text"
            required
            autoComplete="organization"
            className={fieldClass}
            placeholder="Your brokerage or trade desk"
          />
        </div>
        <div>
          <label htmlFor="demo-phone" className="auth-label">
            Phone
          </label>
          <input
            id="demo-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={fieldClass}
            placeholder="+1 555 000 0000"
          />
        </div>
        <div>
          <label htmlFor="demo-jobTitle" className="auth-label">
            Job title
          </label>
          <input
            id="demo-jobTitle"
            name="jobTitle"
            type="text"
            autoComplete="organization-title"
            className={fieldClass}
            placeholder="Customs manager"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="demo-monthlyVolume" className="auth-label">
            Monthly shipment volume
          </label>
          <select
            id="demo-monthlyVolume"
            name="monthlyVolume"
            className={fieldClass}
            defaultValue=""
          >
            {VOLUME_OPTIONS.map((o) => (
              <option key={o.value || "empty"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="demo-message" className="auth-label">
            What would you like to see in the demo?
          </label>
          <textarea
            id="demo-message"
            name="message"
            rows={4}
            className={`${fieldClass} resize-y min-h-[100px]`}
            placeholder="e.g. HS grouping for mixed SKU packing lists, export workflow…"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        By submitting, you agree to be contacted about Impact Logistics. We do
        not share your information with third parties.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full auth-btn disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Request free demo"}
      </button>
    </form>
  );
}
