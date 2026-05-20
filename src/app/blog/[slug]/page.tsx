import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getPostBySlug, getRelatedPosts, type ContentBlock } from "@/lib/blog-posts";

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return {};
  return {
    title: `${post.title} — BARITUR PRO`,
    description: post.description,
    alternates: { canonical: `https://bariturpro.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: ["BARITUR PRO"],
      tags: post.tags,
    },
    keywords: post.tags,
  };
}

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

function renderBlock(block: ContentBlock, i: number) {
  switch (block.type) {
    case "h2":
      return (
        <h2 key={i} className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-20">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-3">
          {block.text}
        </h3>
      );
    case "p":
      return (
        <p key={i} className="text-gray-700 leading-relaxed mb-4">
          {block.text}
        </p>
      );
    case "ul":
      return (
        <ul key={i} className="list-disc pl-6 mb-4 space-y-1.5 text-gray-700">
          {block.items.map((item, j) => (
            <li key={j} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={i} className="list-decimal pl-6 mb-4 space-y-1.5 text-gray-700">
          {block.items.map((item, j) => (
            <li key={j} className="leading-relaxed">{item}</li>
          ))}
        </ol>
      );
    case "callout": {
      const styles = {
        info: "bg-blue-50 border-blue-200 text-blue-900",
        warning: "bg-amber-50 border-amber-200 text-amber-900",
        success: "bg-emerald-50 border-emerald-200 text-emerald-900",
      };
      return (
        <aside key={i} className={`my-6 border-l-4 rounded-r-lg p-4 ${styles[block.tone]}`}>
          <p className="font-semibold text-sm mb-1">{block.title}</p>
          <p className="text-sm leading-relaxed">{block.text}</p>
        </aside>
      );
    }
    case "cta":
      return (
        <div key={i} className="my-8 bg-gradient-to-br from-slate-900 to-blue-900 rounded-xl p-6 text-white">
          <h4 className="font-bold text-base mb-3">{block.title}</h4>
          <Link
            href={block.href}
            className="inline-block px-5 py-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg text-sm transition"
          >
            {block.label}
          </Link>
        </div>
      );
    case "quote":
      return (
        <blockquote key={i} className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-6">
          {block.text}
        </blockquote>
      );
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) return notFound();

  const related = getRelatedPosts(post.slug, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { "@type": "Organization", name: "BARITUR PRO" },
    publisher: {
      "@type": "Organization",
      name: "BARITUR PRO",
      logo: { "@type": "ImageObject", url: "https://bariturpro.com/icon" },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://bariturpro.com/blog/${post.slug}` },
    keywords: post.tags.join(", "),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-white">
        <SiteHeader />

        {/* Breadcrumb */}
        <nav className="max-w-3xl mx-auto px-4 py-3 text-xs text-gray-500">
          <Link href="/" className="hover:text-primary">Inicio</Link>
          <span className="mx-2">›</span>
          <Link href="/blog" className="hover:text-primary">Blog</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-700">{post.category}</span>
        </nav>

        {/* Article */}
        <article className="max-w-3xl mx-auto px-4 pb-12">
          <header className="mb-8 pb-6 border-b">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${CATEGORY_COLORS[post.category]}`}>
                {post.category}
              </span>
              <span className="text-xs text-gray-500">
                {formatDate(post.publishedAt)} · {post.readingMinutes} min de lectura
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-lg text-gray-600 leading-relaxed">{post.lead}</p>
          </header>

          <div className="prose-content">
            {post.blocks.map(renderBlock)}
          </div>

          {/* Tags */}
          <div className="mt-10 pt-6 border-t flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                #{t}
              </span>
            ))}
          </div>

          {/* Author / about */}
          <div className="mt-8 bg-gray-50 rounded-xl p-5 border">
            <p className="text-sm text-gray-700">
              <strong>BARITUR PRO</strong> es la plataforma SaaS para gestorías y funerarias que automatiza el seguimiento del Impuesto de Sucesiones, plazos legales y trámites post-fallecimiento en España.
            </p>
            <Link href="/#demo" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Probar gratis 14 días →
            </Link>
          </div>
        </article>

        {/* Related */}
        {related.length > 0 && (
          <div className="bg-gray-50 border-t">
            <div className="max-w-5xl mx-auto px-4 py-12">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Sigue leyendo</h2>
              <div className="grid sm:grid-cols-3 gap-5">
                {related.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="bg-white border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition group"
                  >
                    <span className={`inline-block text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded mb-2 ${CATEGORY_COLORS[p.category]}`}>
                      {p.category}
                    </span>
                    <h3 className="font-bold text-gray-900 leading-snug group-hover:text-primary transition text-sm">
                      {p.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
        <SiteFooter />
      </div>
    </>
  );
}
