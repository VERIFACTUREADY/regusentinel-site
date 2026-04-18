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
          background: "#1e40af",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 18,
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
