import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recuperar contrasena",
  description: "Restablece tu contrasena de BARITUR PRO.",
  robots: { index: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
