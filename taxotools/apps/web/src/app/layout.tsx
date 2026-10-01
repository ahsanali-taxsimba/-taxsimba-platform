import type { Metadata } from "next";
import { AppMotionShell } from "@/motion/AppMotionShell";
import "./globals.css";

// Prefer London — Supabase project is eu-west-2; iad1 was adding multi-second DB RTT.
export const preferredRegion = ["lhr1"];

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
    <html lang="en-GB">
      <body className="bg-apple-bg font-sans text-body text-apple-text antialiased">
        <AppMotionShell>{children}</AppMotionShell>
      </body>
    </html>
  );
}
