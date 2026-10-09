import { createFileRoute } from "@tanstack/react-router";
import Page from "@/kaktus/pages/login";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Kaktus" },
      { name: "description", content: "Sign in to your Kaktus workspace." },
      { property: "og:title", content: "Sign in — Kaktus" },
      { property: "og:description", content: "Sign in to your Kaktus workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
