import type { Metadata } from "next";
import { Space_Grotesk, Fira_Code } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const customFont = Space_Grotesk({
  variable: "--font-custom",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const customMono = Fira_Code({
  variable: "--font-custom-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kaktus",
  description: "AI-assisted circuit, PCB, firmware, and hardware validation workspace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${customFont.variable} ${customMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans relative">
        <AuthProvider>
          {children}
        </AuthProvider>
        <div className="fixed bottom-3 left-3 z-[9999] felt-patch text-[10px] px-3 py-1.5 pointer-events-none select-none tracking-wider uppercase font-bold text-[#2c2420]">
          Prototype Version
        </div>
      </body>
    </html>
  );
}
