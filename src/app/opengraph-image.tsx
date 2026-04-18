import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BARITUR PRO — Gestion post-mortem profesional";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #172554 100%)",
          color: "white",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              marginBottom: 16,
            }}
          >
            BARITUR PRO
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              opacity: 0.9,
              marginBottom: 40,
              maxWidth: 700,
              lineHeight: 1.4,
            }}
          >
            Software de gestion post-mortem para gestorias y funerarias
          </div>
          <div
            style={{
              display: "flex",
              gap: 32,
              fontSize: 18,
              opacity: 0.75,
            }}
          >
            <span>Motor de plazos ISD</span>
            <span>·</span>
            <span>Portal familia</span>
            <span>·</span>
            <span>Pack banco</span>
            <span>·</span>
            <span>RGPD</span>
          </div>
          <div
            style={{
              marginTop: 48,
              padding: "12px 32px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            baritur.pro — Desde 149 EUR/mes
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
