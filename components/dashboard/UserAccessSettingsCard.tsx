"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DashButton,
  DashCard,
  DashCardHeader,
} from "@/components/dashboard/ui";
import {
  USER_ROLE_LABELS,
  USER_ROLES,
  isUserRole,
  type UserRole,
} from "@/lib/auth/roles";

const selectClass =
  "w-full max-w-xs py-2 px-3 text-sm text-gray-900 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12 capitalize disabled:opacity-60";

type UserAccessSettingsCardProps = {
  userId: string;
  role: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  canEdit: boolean;
  viewerRole?: string | null;
};

export function UserAccessSettingsCard({
  userId,
  role: initialRole,
  emailVerified: initialEmail,
  phoneVerified: initialPhone,
  canEdit,
  viewerRole = null,
}: UserAccessSettingsCardProps) {
  const router = useRouter();
  const roleValue = isUserRole(initialRole) ? initialRole : "user";
  const [role, setRole] = useState<UserRole>(roleValue);
  const [emailVerified, setEmailVerified] = useState(initialEmail);
  const [phoneVerified, setPhoneVerified] = useState(initialPhone);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () =>
      role !== roleValue ||
      emailVerified !== initialEmail ||
      phoneVerified !== initialPhone,
    [role, roleValue, emailVerified, initialEmail, phoneVerified, initialPhone],
  );

  const roleLabel = isUserRole(initialRole)
    ? USER_ROLE_LABELS[initialRole]
    : initialRole;

  async function handleSave() {
    if (!canEdit || !dirty) return;
    setSaving(true);

    try {
      if (role !== roleValue) {
        const res = await fetch(`/api/dashboard/users/${userId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to update role");
        }
      }

      if (
        emailVerified !== initialEmail ||
        phoneVerified !== initialPhone
      ) {
        const res = await fetch(`/api/dashboard/users/${userId}/verification`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailVerified, phoneVerified }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to update verification");
        }
      }

      toast.success("Access settings saved");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashCard>
      <DashCardHeader title="Role & verification" />
      <div className="p-5 sm:p-6 space-y-6">
        {canEdit ? (
          <>
            <div>
              <label
                htmlFor={`role-${userId}`}
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Assign role
              </label>
              <select
                id={`role-${userId}`}
                value={role}
                disabled={saving}
                onChange={(e) => {
                  const next = e.target.value;
                  if (isUserRole(next)) setRole(next);
                }}
                className={selectClass}
                aria-label="User role"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {USER_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">
                Admin, Assessor, User, or Client.
              </p>
            </div>

            <div className="space-y-4 border-t border-slate-100 pt-5">
              <ToggleRow
                label="Email verified"
                description="Mark email as verified so the user can sign in without a verification link."
                checked={emailVerified}
                disabled={saving}
                onChange={setEmailVerified}
              />
              <ToggleRow
                label="Phone verified"
                description="Mark phone as verified for SMS alerts and inbound SMS commands."
                checked={phoneVerified}
                disabled={saving}
                onChange={setPhoneVerified}
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <DashButton
                type="button"
                disabled={saving || !dirty}
                onClick={() => void handleSave()}
              >
                {saving ? "Saving…" : "Save"}
              </DashButton>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Current role:{" "}
              <span className="font-medium text-gray-900">{roleLabel}</span>
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Email:{" "}
                <span className="font-medium text-gray-900">
                  {initialEmail ? "Verified" : "Unverified"}
                </span>
              </p>
              <p className="text-sm text-gray-700">
                Phone:{" "}
                <span className="font-medium text-gray-900">
                  {initialPhone ? "Verified" : "Unverified"}
                </span>
              </p>
            </div>
            <p className="text-sm text-gray-500">
              Only admins can change role and verification.
              {viewerRole && viewerRole !== "admin"
                ? ` You are signed in as ${isUserRole(viewerRole) ? USER_ROLE_LABELS[viewerRole] : viewerRole}.`
                : " Ask an administrator to grant you admin access, or promote your account in the database."}
            </p>
          </>
        )}
      </div>
    </DashCard>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-[#007bff]" : "bg-gray-200"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
