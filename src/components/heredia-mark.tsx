/**
 * Brand mark de Heredia.
 *
 * Letra "H" geométrica monoline con el crossbar elevado al 58% de
 * la altura — sutil referencia al dintel de un umbral arquitectónico.
 * Tres variantes para todos los contextos: gradiente (primario),
 * slate sólido (sobre fondo claro), y blanco (sobre fondo oscuro).
 */
export function HerediaMark({
  className = "w-9 h-9",
  variant = "gradient",
}: {
  className?: string;
  variant?: "gradient" | "slate" | "white";
}) {
  const fill =
    variant === "gradient"
      ? "url(#heredia-grad)"
      : variant === "white"
        ? "#ffffff"
        : "#0f172a";
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      role="img"
      aria-label="Heredia"
      xmlns="http://www.w3.org/2000/svg"
    >
      {variant === "gradient" && (
        <defs>
          <linearGradient id="heredia-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      )}
      {/* Columna izquierda */}
      <rect x="43" y="28" width="36" height="200" rx="7" fill={fill} />
      {/* Columna derecha */}
      <rect x="177" y="28" width="36" height="200" rx="7" fill={fill} />
      {/* Dintel (crossbar elevado al 58% desde la base) */}
      <rect x="79" y="94" width="98" height="36" rx="7" fill={fill} />
    </svg>
  );
}
