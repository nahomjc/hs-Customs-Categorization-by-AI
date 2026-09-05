export const USER_LIST_SORT_FIELDS = [
  "createdAt",
  "fullName",
  "email",
  "role",
  "status",
] as const;

export type UserListSortField = (typeof USER_LIST_SORT_FIELDS)[number];

export const USER_LIST_PAGE_SIZES = [10, 25, 50, 100] as const;

export type UserListStatusFilter = "active" | "inactive" | "all";
