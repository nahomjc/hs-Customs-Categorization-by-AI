"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  USER_ROLE_LABELS,
  USER_ROLES,
  isUserRole,
  type UserRole,
} from "@/lib/auth/roles";

const selectClass =
  "w-full min-w-[7.5rem] py-1.5 px-2.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#007bff] focus:ring-2 focus:ring-[#007bff]/15 capitalize disabled:opacity-60";

type UserRoleSelectProps = {
  userId: string;
  value: string;
  canEdit: boolean;
  id?: string;
};

export function UserRoleSelect({
  userId,
  value,
  canEdit,
  id,
}: UserRoleSelectProps) {
  const router = useRouter();
  const initial = isUserRole(value) ? value : "user";
  const [role, setRole] = useState<UserRole>(initial);
  const [saving, setSaving] = useState(false);

  if (!canEdit) {
    return (
      <span className="capitalize text-gray-700">
        {USER_ROLE_LABELS[initial] ?? value}
      </span>
    );
  }

  async function onChange(next: string) {
    if (!isUserRole(next) || next === role) return;

    const previous = role;
    setRole(next);
    setSaving(true);

    try {
      const res = await fetch(`/api/dashboard/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setRole(previous);
        toast.error(data.error ?? "Failed to update role");
        return;
      }

      toast.success(`Role set to ${USER_ROLE_LABELS[next]}`);
      router.refresh();
    } catch {
      setRole(previous);
      toast.error("Failed to update role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      id={id}
      value={role}
      disabled={saving}
      onChange={(e) => void onChange(e.target.value)}
      className={selectClass}
      aria-label="User role"
    >
      {USER_ROLES.map((r) => (
        <option key={r} value={r}>
          {USER_ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}
