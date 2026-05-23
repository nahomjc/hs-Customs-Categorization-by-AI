"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { DashCard, DashCardHeader, PageHeader } from "@/components/dashboard/ui";

const fieldClass =
  "w-full py-2.5 px-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12";

export function InviteUserForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      email: String(form.get("email") ?? "").trim(),
      fullName: String(form.get("fullName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    };

    try {
      const res = await fetch("/api/dashboard/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        resent?: boolean;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send invite");
      }

      toast.success(
        data.message ??
          (data.resent
            ? "Invite resent — user was already in auth and is now synced to the list."
            : "Invite email sent. Check spam if it does not arrive.")
      );
      router.push("/dashboard/users");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Invite user"
        description="Create an account and send an invitation email with login details."
        action={
          <Link
            href="/dashboard/users"
            className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back to user list
          </Link>
        }
      />

      <DashCard>
        <DashCardHeader title="User details" />
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className={fieldClass}
              placeholder="user@company.com"
            />
          </div>
          <div>
            <label htmlFor="invite-fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name
            </label>
            <input
              id="invite-fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              className={fieldClass}
              placeholder="Full name"
            />
          </div>
          <div>
            <label htmlFor="invite-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone
            </label>
            <input
              id="invite-phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              className={fieldClass}
              placeholder="+1 555 000 0000"
            />
          </div>
          <div>
            <label htmlFor="invite-password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <PasswordInput
              id="invite-password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Temporary password for first sign-in. They must choose a new password after accepting the invite.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#007bff] hover:bg-[#0069d9] disabled:opacity-60 transition-colors"
            >
              {loading ? "Sending invite…" : "Send invite"}
            </button>
            <Link
              href="/dashboard/users"
              className="inline-flex justify-center items-center px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </DashCard>
    </div>
  );
}
