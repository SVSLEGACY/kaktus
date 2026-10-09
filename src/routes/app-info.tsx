import { createFileRoute } from "@tanstack/react-router";
import Page from "@/kaktus/pages/app-info";

export const Route = createFileRoute("/app-info")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "About Kaktus" },
      { name: "description", content: "What Kaktus is and how it works." },
      { property: "og:title", content: "About Kaktus" },
      { property: "og:description", content: "What Kaktus is and how it works." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
