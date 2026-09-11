import Script from "next/script";
// Removed next/font/google to fix ETIMEDOUT during docker build
import { Suspense } from "react";

// import "./developer.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import FontClassWrapper from "@/components/FontClassWrapper";
import SessionWrapper from "../components/default/SessionWrapper";
import SessionTimeout from "@/components/SessionTimeout";
import CookieConsent from "@/components/CookieConsent";
import { Toaster } from "react-hot-toast";
import "bootstrap/dist/css/bootstrap.min.css";
import "@smastrom/react-rating/style.css";
import 'swiper/css';
import 'swiper/css/navigation';
import "swiper/css/free-mode";
import "./common.css";
import "./developers.css"
import "./globals.css";
import BootstrapClient from "@/components/BootstrapClient";
import TaxDataLoader from "@/components/default/TaxDataLoader";

const geistSans = { variable: "font-geist-sans" };
const geistMono = { variable: "font-geist-mono" };

const isStaging = process.env.NEXT_PUBLIC_IS_STAGING === "true" || process.env.NODE_ENV === "staging";

export const metadata = {
  title: "TaxSimba — UK Tax Returns & Self Assessment Filing",
  description: "Fast, affordable UK self-assessment tax returns from £120. Expert accountants, HMRC submission, and dedicated support. Get started with TaxSimba today.",
  ...(isStaging ? { robots: { index: false, follow: false } } : {}),
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Google Tag Manager */}
        <Script
          id="gtm-base"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PLL2PLKZ');`,
          }}
        />
        {/* End Google Tag Manager */}
        <meta
          name="google-site-verification"
          content="QWD6O7vR8OggxhW84Cku0icp-2sgnTGFrbKzmMp4KSw"
        />
        {/* Font Awesome CDN */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
          integrity="sha512-..."
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LT8D06Y49W"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LT8D06Y49W');
          `}
        </Script>
      </head>
      <body suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PLL2PLKZ"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        <BootstrapClient />
        <SessionWrapper>
          <Toaster position="top-right" reverseOrder={false} containerClassName="hot-toast-container" containerStyle={{ zIndex: 99999999 }} />
          <SessionTimeout />
          <TaxDataLoader />
          <FontClassWrapper geistSans={geistSans} geistMono={geistMono}>
            <div className="page_wrapper">
              <Suspense fallback={null}>
                <Navbar />
              </Suspense>
              <main>
                {children}
              </main>
              <Footer />
              <CookieConsent />
            </div>
          </FontClassWrapper>
        </SessionWrapper>
      </body>
    </html>
  );
}