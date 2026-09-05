"use client";

import { useRouter } from "next/navigation";
import { USER_LIST_PAGE_SIZES } from "@/lib/dashboard/users-list-constants";
import {
  buildUsersHref,
  type UsersFilters,
} from "@/lib/dashboard/users-list-href";

const selectClass =
  "py-1.5 pl-2.5 pr-7 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#007bff] focus:ring-[3px] focus:ring-[#007bff]/12";

export function UsersPageSizeSelect({ filters }: { filters: UsersFilters }) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-xs text-gray-500">
      <span className="whitespace-nowrap">Per page</span>
      <select
        aria-label="Rows per page"
        value={filters.pageSize}
        className={selectClass}
        onChange={(e) => {
          const pageSize = Number(e.target.value);
          router.push(
            buildUsersHref(filters, {
              pageSize: Number.isFinite(pageSize) ? pageSize : 25,
              page: 1,
            }),
          );
        }}
      >
        {USER_LIST_PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </label>
  );
}
