import { createFileRoute } from "@tanstack/react-router";
import Page from "@/kaktus/pages/pcb-designer";

export const Route = createFileRoute("/pcb-designer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kaktus PCB Designer" },
      { name: "description", content: "Lay out printed circuit boards with AI help." },
      { property: "og:title", content: "Kaktus PCB Designer" },
      { property: "og:description", content: "Lay out printed circuit boards with AI help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
