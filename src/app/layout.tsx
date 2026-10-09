import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "Kaktus — AI hardware studio",
  description: "AI-assisted circuit, PCB, firmware, and hardware validation workspace",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900;1000&family=Fira+Code:wght@300..700&display=swap"
        />
      </head>
      <body className="kaktus-theme min-h-full flex flex-col font-sans relative">
        <img
          src="/assets/stitched-fabric.jpg"
          alt=""
          aria-hidden="true"
          width={1536}
          height={1024}
          className="fabric-backdrop"
        />
        <AuthProvider>
          {children}
        </AuthProvider>
        <div className="prototype-label fixed bottom-2 left-2 z-[9999] font-mono text-[10px] px-2 py-1 pointer-events-none select-none uppercase">
          Prototype Version
        </div>
      </body>
    </html>
  );
}
