"use client";

import { TranslationProvider } from "@/context/TranslationContext";
import { TaxDataProvider } from "@/context/TaxDataContext";
import { SessionProvider } from "next-auth/react";

export default function SessionWrapper({ children, session }) {
  return (
    <SessionProvider session={session} basePath="/frontend-api/auth">
      <TaxDataProvider>
        <TranslationProvider>{children}</TranslationProvider>
      </TaxDataProvider>
    </SessionProvider>
  );
}