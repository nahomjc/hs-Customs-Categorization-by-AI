"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { DashCard, DashCardHeader } from "@/components/dashboard/ui";
import { authClient } from "@/lib/auth/auth-client";
import { USER_ROLE_LABELS, isUserRole } from "@/lib/auth/roles";

const fieldClass =
  "w-full py-2.5 px-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12";

type AccountSection = "account" | "password";

type AccountProfilePanelProps = {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  phone: string | null;
};

const NAV_ITEMS: { id: AccountSection; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "password", label: "Change password" },
];

function getInitials(name: string | null, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function AccountProfilePanel({
  email,
  fullName: initialName,
  avatarUrl: initialAvatar,
  role,
  phone,
}: AccountProfilePanelProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<AccountSection>("account");
  const [fullName, setFullName] = useState(initialName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const roleLabel = isUserRole(role) ? USER_ROLE_LABELS[role] : role;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save profile");
      toast.success("Profile updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("photo", file);
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setAvatarUrl(data.avatarUrl ?? null);
      toast.success("Photo updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    setUploading(true);
    try {
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not remove photo");
      setAvatarUrl(null);
      toast.success("Photo removed");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Remove failed");
    } finally {
      setUploading(false);
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingPassword(true);
    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setSavingPassword(false);
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setSavingPassword(false);
      toast.error("Password must be at least 8 characters");
      return;
    }

    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    });

    setSavingPassword(false);

    if (error) {
      toast.error(error.message ?? "Could not update password");
      return;
    }

    e.currentTarget.reset();
    toast.success("Password updated");
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="shrink-0 lg:w-56">
        <nav
          aria-label="Account sections"
          className="flex gap-1 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5 lg:flex-col lg:overflow-visible"
        >
          {NAV_ITEMS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#007bff] text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 max-w-2xl">
        {section === "account" ? (
          <DashCard>
            <DashCardHeader title="Account" />
            <form onSubmit={saveProfile} className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-24 w-24 rounded-2xl border border-gray-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#007bff] text-2xl font-bold text-white">
                      {getInitials(fullName || initialName, email)}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">
                    Profile photo
                  </p>
                  <p className="text-xs text-gray-500">
                    JPEG, PNG, WebP, or GIF · max 2MB
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {uploading ? "Uploading…" : "Upload photo"}
                    </button>
                    {avatarUrl ? (
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => void removePhoto()}
                        className="rounded-xl border border-red-100 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) =>
                      void onPhotoSelected(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="account-fullName"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Full name
                  </label>
                  <input
                    id="account-fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={fieldClass}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="account-email"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    id="account-email"
                    value={email}
                    disabled
                    className={`${fieldClass} cursor-not-allowed bg-gray-50 text-gray-500`}
                  />
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-gray-700">
                    Role
                  </span>
                  <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-[#007bff]">
                    {roleLabel}
                  </span>
                </div>
                {phone ? (
                  <div className="sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium text-gray-700">
                      Phone
                    </span>
                    <p className="text-sm text-gray-900">{phone}</p>
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-xl bg-[#007bff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0069d9] disabled:opacity-50"
              >
                {savingProfile ? "Saving…" : "Save profile"}
              </button>
            </form>
          </DashCard>
        ) : (
          <DashCard>
            <DashCardHeader title="Change password" />
            <form onSubmit={changePassword} className="space-y-4 p-5 sm:p-6">
              <div>
                <label
                  htmlFor="account-current-password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Current password
                </label>
                <PasswordInput
                  id="account-current-password"
                  name="currentPassword"
                  required
                  autoComplete="current-password"
                  className={fieldClass}
                  placeholder="Current password"
                />
              </div>
              <div>
                <label
                  htmlFor="account-new-password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  New password
                </label>
                <PasswordInput
                  id="account-new-password"
                  name="newPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={fieldClass}
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label
                  htmlFor="account-confirm-password"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  Confirm new password
                </label>
                <PasswordInput
                  id="account-confirm-password"
                  name="confirmPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={fieldClass}
                  placeholder="Repeat new password"
                />
              </div>
              <button
                type="submit"
                disabled={savingPassword}
                className="rounded-xl bg-[#007bff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0069d9] disabled:opacity-50"
              >
                {savingPassword ? "Updating…" : "Update password"}
              </button>
            </form>
          </DashCard>
        )}
      </div>
    </div>
  );
}
