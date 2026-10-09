import { createFileRoute } from "@tanstack/react-router";
import Page from "@/kaktus/pages/how-to-use";

export const Route = createFileRoute("/how-to-use")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "How to use Kaktus" },
      { name: "description", content: "A quick guide to building hardware with Kaktus." },
      { property: "og:title", content: "How to use Kaktus" },
      { property: "og:description", content: "A quick guide to building hardware with Kaktus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
