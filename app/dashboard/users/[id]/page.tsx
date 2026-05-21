import Link from "next/link";
import { UserDetailPanel } from "@/components/dashboard/UserDetailPanel";
import { getDashboardUserDetail } from "@/lib/dashboard/users";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getDashboardUserDetail(id);

  if (!user) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/users"
          className="text-sm text-[#007bff] hover:underline font-medium"
        >
          ← Back to user list
        </Link>
        <div className="landing-float-card bg-white rounded-2xl p-8 text-center">
          <p className="font-semibold text-gray-900">User not found</p>
          <p className="text-sm text-gray-500 mt-1">
            This user may have been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/users"
        className="inline-flex items-center gap-1.5 text-sm text-[#007bff] hover:underline font-medium"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to user list
      </Link>
      <UserDetailPanel user={user} />
    </div>
  );
}
