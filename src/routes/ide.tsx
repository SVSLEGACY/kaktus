import { createFileRoute } from "@tanstack/react-router";
import Page from "@/kaktus/pages/ide";

export const Route = createFileRoute("/ide")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kaktus IDE" },
      { name: "description", content: "Design circuits and firmware with an AI co-pilot." },
      { property: "og:title", content: "Kaktus IDE" },
      { property: "og:description", content: "Design circuits and firmware with an AI co-pilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
