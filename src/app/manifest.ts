import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BARITUR PRO",
    short_name: "BARITUR",
    description: "Software de gestion post-mortem para gestorias y funerarias",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#1e40af",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
