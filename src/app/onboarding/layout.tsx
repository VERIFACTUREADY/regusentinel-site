import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registro — Crea tu cuenta BARITUR PRO",
  description: "Configura tu organizacion en 3 pasos. 14 dias de prueba gratuita sin tarjeta.",
  alternates: { canonical: "https://baritur.pro/onboarding" },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
