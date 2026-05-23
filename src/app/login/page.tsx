import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { ssoEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description: "Accede a tu cuenta de BARITUR PRO para gestionar tus expedientes post-mortem.",
  robots: { index: false },
};

export default function LoginPage() {
  const demoEnabled = process.env.DEMO_ENABLED === "true";
  return (
    <Suspense>
      <LoginForm demoEnabled={demoEnabled} ssoEnabled={ssoEnabled} />
    </Suspense>
  );
}
