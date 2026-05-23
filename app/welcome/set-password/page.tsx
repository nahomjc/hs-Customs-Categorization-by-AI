import { AuthLayout } from "@/components/auth/AuthLayout";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export default function WelcomeSetPasswordPage() {
  return (
    <AuthLayout
      title="Set your password"
      subtitle="Choose a personal password before using Impact Logistics"
    >
      <SetPasswordForm />
    </AuthLayout>
  );
}
