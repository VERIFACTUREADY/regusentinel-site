import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Blog Heredia — Guías sobre el Impuesto de Sucesiones y trámites de herencia",
  description:
    "Artículos sobre plazos del Modelo 650, certificados, valor de referencia del catastro, comparativas entre CCAA y trámites tras una defunción en España.",
  alternates: { canonical: "https://heredia.app/blog" },
  openGraph: {
    title: "Blog Heredia",
    description: "Guías prácticas sobre ISD, Modelo 650 y trámites de herencia",
    type: "website",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  Plazos: "bg-amber-100 text-amber-700",
  Tramites: "bg-blue-100 text-blue-700",
  Fiscalidad: "bg-purple-100 text-purple-700",
  CCAA: "bg-emerald-100 text-emerald-700",
  Profesional: "bg-rose-100 text-rose-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogIndexPage() {
  const sorted = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const featured = sorted[0];
  const rest = sorted.slice(1);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog Heredia",
    description: "Guías prácticas sobre ISD, Modelo 650 y trámites de herencia en España",
    blogPost: sorted.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.publishedAt,
      url: `https://heredia.app/blog/${p.slug}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-gray-50">
        <SiteHeader />

        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-blue-900 text-white">
          <div className="absolute inset-0 dot-grid-light opacity-30" />
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-float-slow" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 bg-blue-400/25 rounded-full blur-3xl animate-float" />
          <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-16">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Blog Heredia</h1>
            <p className="text-base sm:text-lg text-blue-100 max-w-2xl">
              Guías prácticas sobre el Impuesto de Sucesiones, Modelo 650, plazos legales,
              valor de referencia del Catastro y trámites tras una defunción en España.
            </p>
          </div>
        </div>

        {/* Featured post */}
        {featured && (
          <div className="max-w-5xl mx-auto px-4 -mt-6 mb-10 relative z-0">
            <Link
              href={`/blog/${featured.slug}`}
              className="block bg-white rounded-2xl shadow-lg border p-6 sm:p-8 hover:shadow-xl transition group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${CATEGORY_COLORS[featured.category]}`}>
                  {featured.category}
                </span>
                <span className="text-xs text-gray-500">{formatDate(featured.publishedAt)} · {featured.readingMinutes} min</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 group-hover:text-primary transition">
                {featured.title}
              </h2>
              <p className="text-sm text-gray-600">{featured.lead}</p>
              <p className="mt-4 text-sm font-medium text-primary group-hover:underline">
                Leer artículo completo →
              </p>
            </Link>
          </div>
        )}

        {/* Rest of posts */}
        <div className="max-w-5xl mx-auto px-4 pb-16">
          <div className="grid sm:grid-cols-2 gap-5">
            {rest.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="bg-white border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${CATEGORY_COLORS[p.category]}`}>
                    {p.category}
                  </span>
                  <span className="text-xs text-gray-500">{p.readingMinutes} min</span>
                </div>
                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-primary transition leading-snug">
                  {p.title}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2">{p.description}</p>
                <p className="mt-3 text-xs text-gray-400">{formatDate(p.publishedAt)}</p>
              </Link>
            ))}
          </div>
        </div>
        <SiteFooter />
      </div>
    </>
  );
}
