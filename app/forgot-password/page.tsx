import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Reset password" subtitle="We will email you a secure reset link">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
