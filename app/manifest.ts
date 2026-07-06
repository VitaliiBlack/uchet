import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Uchet",
    short_name: "Uchet",
    description: "Учёт доходов и расходов по магазинам",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f8f6",
    theme_color: "#f8f8f6",
    orientation: "portrait",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
