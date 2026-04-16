import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = process.env.NEXTAUTH_URL || "https://baritur.pro";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "BARITUR PRO — Gestión post-mortem para gestorías y funerarias",
    template: "%s | BARITUR PRO",
  },
  description:
    "Software B2B para gestorías y funerarias que automatiza los trámites post-fallecimiento: bancos, suministros, fiscal (Modelo 650), portal familia y motor de plazos ISD.",
  keywords: [
    "gestion post-mortem",
    "tramites fallecimiento",
    "modelo 650 ISD",
    "gestoria herencias",
    "software gestion herencias",
    "portal familia fallecimiento",
    "certificado ultimas voluntades",
  ],
  authors: [{ name: "BARITUR PRO", url: BASE_URL }],
  creator: "BARITUR PRO",
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: BASE_URL,
    siteName: "BARITUR PRO",
    title: "BARITUR PRO — Software de gestión post-mortem",
    description:
      "+436.000 defunciones al año en España. Cada una genera decenas de trámites. BARITUR orquesta todo: bancos, fiscal, suministros, portal familia y motor de plazos ISD.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BARITUR PRO — Gestión post-mortem profesional",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BARITUR PRO — Software de gestión post-mortem",
    description:
      "Automatiza los trámites post-fallecimiento: bancos, Modelo 650, suministros y portal familia con plazos ISD en tiempo real.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
