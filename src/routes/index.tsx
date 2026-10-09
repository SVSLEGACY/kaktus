import { createFileRoute } from "@tanstack/react-router";
import Page from "@/kaktus/pages/home";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kaktus — AI hardware studio" },
      { name: "description", content: "AI-assisted circuit, PCB, firmware, and hardware validation workspace." },
      { property: "og:title", content: "Kaktus — AI hardware studio" },
      { property: "og:description", content: "AI-assisted circuit, PCB, firmware, and hardware validation workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
