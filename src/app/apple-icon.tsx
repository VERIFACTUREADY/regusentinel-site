import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          background: "linear-gradient(135deg, #1e40af, #1e3a8a)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 100,
          fontWeight: 800,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        B
      </div>
    ),
    { ...size }
  );
}
