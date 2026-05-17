import Link from "next/link";

interface Props {
  urgentCaseId: string | null;
  urgentCaseRef: string | null;
  portalToken: string | null;
  portalCaseRef: string | null;
  bankPackCaseId: string | null;
  bankPackCaseRef: string | null;
}

/**
 * "Prueba esto" panel shown only in the public demo org. Surfaces the
 * three most impressive flows so a prospect sees the product's value
 * without having to explore blind.
 */
export function DemoHighlights({
  urgentCaseId,
  urgentCaseRef,
  portalToken,
  portalCaseRef,
  bankPackCaseId,
  bankPackCaseRef,
}: Props) {
  const items: Array<{
    emoji: string;
    title: string;
    desc: string;
    cta: string;
    href: string;
    external?: boolean;
  }> = [];

  if (urgentCaseId) {
    items.push({
      emoji: "⚠️",
      title: "Expediente urgente",
      desc: `El Modelo 650 de ${urgentCaseRef} vence esta semana. Mira cómo se gestiona el plazo ISD.`,
      cta: "Abrir expediente",
      href: `/cases/${urgentCaseId}`,
    });
  }
  if (portalToken) {
    items.push({
      emoji: "👨‍👩‍👧",
      title: "Portal familia brandado",
      desc: `Lo que ve el familiar del expediente ${portalCaseRef}. Con tu logo y colores.`,
      cta: "Ver portal (pestaña nueva)",
      href: `/portal/${portalToken}`,
      external: true,
    });
  }
  if (bankPackCaseId) {
    items.push({
      emoji: "🏦",
      title: "Pack banco unificado",
      desc: `PDF con índice + ZIP con originales del expediente ${bankPackCaseRef}. Listo para presentar.`,
      cta: "Descargar PDF",
      href: `/api/cases/${bankPackCaseId}/bank-pack?format=pdf`,
      external: true,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg p-6 mb-8">
      <div className="mb-4">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-1">
          Prueba la demo en 30 segundos
        </p>
        <h2 className="text-lg font-bold text-gray-900">
          Tres cosas que merece la pena ver
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Son datos ficticios pero el producto es 100% funcional. Si te
          convence, solicita una reunión desde el banner de arriba.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noopener noreferrer" : undefined}
            className="bg-white border border-indigo-100 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition"
          >
            <div className="text-2xl mb-2" aria-hidden>
              {item.emoji}
            </div>
            <p className="font-semibold text-sm text-gray-900">{item.title}</p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              {item.desc}
            </p>
            <p className="text-xs font-medium text-indigo-700 mt-3">
              {item.cta} →
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
