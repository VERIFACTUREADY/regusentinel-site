import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nueva contrasena",
  description: "Establece una nueva contrasena para tu cuenta de Heredia.",
  robots: { index: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
