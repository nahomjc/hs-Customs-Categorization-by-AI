"use server";

import { redirect } from "next/navigation";
import {
  USER_LIST_PAGE_SIZES,
  USER_LIST_SORT_FIELDS,
  type UserListSortField,
} from "@/lib/dashboard/users-list-constants";
import { isUserRole } from "@/lib/auth/roles";

function pickSort(value: FormDataEntryValue | null): UserListSortField {
  const v = String(value ?? "");
  return (USER_LIST_SORT_FIELDS as readonly string[]).includes(v)
    ? (v as UserListSortField)
    : "createdAt";
}

export async function applyUsersListFilters(formData: FormData) {
  const params = new URLSearchParams();

  const q = String(formData.get("q") ?? "").trim();
  if (q) params.set("q", q);

  const role = String(formData.get("role") ?? "").trim();
  if (role && isUserRole(role)) params.set("role", role);

  const status = String(formData.get("status") ?? "").trim();
  if (status === "active" || status === "inactive") {
    params.set("status", status);
  } else if (status === "all") {
    params.set("status", "all");
  }

  const sort = pickSort(formData.get("sort"));
  if (sort !== "createdAt") params.set("sort", sort);

  const order = String(formData.get("order") ?? "desc") === "asc" ? "asc" : "desc";
  if (order !== "desc" || sort !== "createdAt") params.set("order", order);

  const pageSizeRaw = Number(formData.get("pageSize") ?? 25);
  const pageSize = (USER_LIST_PAGE_SIZES as readonly number[]).includes(
    pageSizeRaw,
  )
    ? pageSizeRaw
    : 25;
  if (pageSize !== 25) params.set("pageSize", String(pageSize));

  // Filters restart at page 1
  params.delete("page");

  const qs = params.toString();
  redirect(qs ? `/dashboard/users?${qs}` : "/dashboard/users");
}
