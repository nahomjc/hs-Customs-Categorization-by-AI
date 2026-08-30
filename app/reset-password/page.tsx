import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="Enter a strong password for your account">
      <Suspense
        fallback={
          <p className="auth-muted text-center py-4">Loading…</p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
