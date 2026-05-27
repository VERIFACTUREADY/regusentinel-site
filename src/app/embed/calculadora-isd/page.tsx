import { Metadata } from "next";
import { EmbedClient } from "./embed-client";

export const metadata: Metadata = {
  title: "Calculadora ISD | Heredia",
  robots: { index: false, follow: false },
};

interface SearchParams {
  theme?: string;       // "light" | "dark"
  primary?: string;     // hex sin #
  ccaa?: string;        // CCAA por defecto
  compare?: string;     // "0" para ocultar comparativa
  utm_source?: string;  // tracking del host
}

export default function EmbedCalculadoraISD({ searchParams }: { searchParams: SearchParams }) {
  const theme = searchParams.theme === "dark" ? "dark" : "light";
  const primary = (searchParams.primary || "").replace(/[^a-fA-F0-9]/g, "").slice(0, 6);
  const ccaa = (searchParams.ccaa || "MADRID").toUpperCase();
  const showCompare = searchParams.compare !== "0";
  const utmSource = (searchParams.utm_source || "embed").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);

  return (
    <EmbedClient
      theme={theme}
      primaryHex={primary}
      defaultCcaa={ccaa}
      showCompare={showCompare}
      utmSource={utmSource}
    />
  );
}
