import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppMotionShell } from "@/motion/AppMotionShell";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Taxotools — SEO, AEO & AI Visibility Platform",
    template: "%s · Taxotools",
  },
  description:
    "Taxotools is the multi-tenant SaaS for SEO analytics, rank tracking, technical audits, AI content, and AEO/GEO visibility.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">
        <AppMotionShell>{children}</AppMotionShell>
      </body>
    </html>
  );
}
