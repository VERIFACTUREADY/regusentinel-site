"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#f9fafb",
        }}>
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <p style={{ fontSize: "4rem", fontWeight: "bold", color: "#ef4444", marginBottom: "1rem" }}>Error</p>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#111827", marginBottom: "0.5rem" }}>
              Algo ha ido mal
            </h1>
            <p style={{ color: "#6b7280", marginBottom: "2rem", maxWidth: "28rem" }}>
              Se ha producido un error critico. Nuestro equipo ha sido notificado.
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "1rem", fontFamily: "monospace" }}>
                Ref: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: "0.5rem 1.5rem",
                backgroundColor: "#6366f1",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Intentar de nuevo
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
