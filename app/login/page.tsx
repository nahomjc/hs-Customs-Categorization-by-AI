import { Suspense } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Impact Logistics account">
      <Suspense
        fallback={
          <p className="auth-muted text-center py-4">Loading…</p>
        }
      >
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
