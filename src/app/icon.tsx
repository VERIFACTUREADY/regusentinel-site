import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 22,
          fontWeight: 800,
          fontFamily: "Inter, system-ui, sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        H
      </div>
    ),
    { ...size }
  );
}
