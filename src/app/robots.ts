import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/cases",
          "/billing",
          "/users",
          "/settings/",
          "/admin/",
        ],
      },
    ],
    sitemap: "https://heredia.app/sitemap.xml",
  };
}
