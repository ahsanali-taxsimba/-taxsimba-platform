import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppMotionShell } from "@/motion/AppMotionShell";
import "./globals.css";

// Prefer London — Supabase project is eu-west-2; iad1 was adding multi-second DB RTT.
export const preferredRegion = ["lhr1"];

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
  display: "swap",
  preload: true,
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "600"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Taxotools — SEO That Runs Itself",
    template: "%s · Taxotools",
  },
  description:
    "Taxo Agent, Auto SEO, Content Genius, Smart Ads, and LLM visibility — the Search Atlas–competitive growth engine for agencies.",
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
