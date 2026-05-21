import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="Enter a strong password for your account">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
