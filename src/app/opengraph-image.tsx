import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Heredia — Gestion post-mortem profesional";
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
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
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
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 20,
                background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: "-0.04em",
              }}
            >
              H
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 600,
                letterSpacing: "-0.03em",
              }}
            >
              Heredia
            </div>
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 500,
              opacity: 0.9,
              marginBottom: 40,
              maxWidth: 800,
              lineHeight: 1.35,
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
            <span>Radar ISD</span>
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
            heredia.app — Desde 149 EUR/mes
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
