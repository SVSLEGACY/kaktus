import { createFileRoute } from "@tanstack/react-router";
import Page from "@/kaktus/pages/admin";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Kaktus" },
      { name: "description", content: "Kaktus admin dashboard." },
      { property: "og:title", content: "Admin — Kaktus" },
      { property: "og:description", content: "Kaktus admin dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
