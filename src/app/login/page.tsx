import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesion",
  description: "Accede a tu cuenta de BARITUR PRO para gestionar tus expedientes post-mortem.",
  robots: { index: false },
};

export default function LoginPage() {
  const demoEnabled = process.env.DEMO_ENABLED === "true";
  return <LoginForm demoEnabled={demoEnabled} />;
}
