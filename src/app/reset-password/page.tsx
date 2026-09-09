import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Restablecer contraseña — Heredia",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
