"use client";

import { useRouter } from "next/navigation";
import { USER_LIST_PAGE_SIZES } from "@/lib/dashboard/users-list-constants";
import { DashSelect } from "@/components/dashboard/ui";
import {
  buildUsersHref,
  type UsersFilters,
} from "@/lib/dashboard/users-list-href";

export function UsersPageSizeSelect({ filters }: { filters: UsersFilters }) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-xs text-gray-500">
      <span className="whitespace-nowrap">Per page</span>
      <DashSelect
        aria-label="Rows per page"
        className="min-w-[4.5rem]"
        value={String(filters.pageSize)}
        onChange={(v) => {
          const pageSize = Number(v);
          router.push(
            buildUsersHref(filters, {
              pageSize: Number.isFinite(pageSize) ? pageSize : 25,
              page: 1,
            }),
          );
        }}
        options={USER_LIST_PAGE_SIZES.map((size) => ({
          value: String(size),
          label: String(size),
        }))}
      />
    </label>
  );
}
