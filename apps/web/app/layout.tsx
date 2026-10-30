import "./styles/tokens.css";
import { OperationsBanner } from "./components/operations-banner";
import "./operations.css";
import { siteOrigin } from "./lib/site-metadata";
import { DialogFocus } from "./components/dialog-focus";
import { IconFontReady } from "./components/icon-font-ready";
import { GoogleOneTap } from "./components/google-one-tap";
import { MobilePlatformProvider } from "./components/mobile-platform-provider";
import { UpgradeModal } from "./components/upgrade-modal";
import { AuthProvider } from "./lib/auth-context";
import { WSProvider } from "./lib/ws-context";
import { LocaleProvider } from "./lib/locale-context";
import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./styles.css";
import "./auth.css";
import "./extras.css";
import "./tw-utils.css";
import "./components/header-nav.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "MapsBridge | AI Travel and Smart Route Platform",
    template: "%s | MapsBridge",
  },
  description:
    "Plan trips with an AI assistant, an intelligent map desk, travel research, and a traveler community.",
  metadataBase: siteOrigin ? new URL(siteOrigin) : new URL("https://mapsbridge.com"),
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${plusJakartaSans.variable}`}
    >
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;if(p!='/en'&&!p.startsWith('/en/'))document.documentElement.lang='tr';document.documentElement.dataset.theme='light';localStorage.setItem('mapsbridge.theme','light');}catch(e){}})();`,
          }}
        />
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Travelpayouts Drive — affiliate attribution */}
        <script
          data-cmp-ab="2"
          data-no-defer="1"
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=document.createElement("script");s.async=1;s.setAttribute("data-cmp-ab","2");s.src="https://emrldco.com/NTg1MDg5.js?t=585089";document.head.appendChild(s);})();`,
          }}
        />
      </head>
      <body>
        <AuthProvider>
          <WSProvider>
            <IconFontReady />
            <DialogFocus />
            <GoogleOneTap />
            <UpgradeModal />
            <LocaleProvider>
              <MobilePlatformProvider>{children}</MobilePlatformProvider>
            </LocaleProvider>
            <OperationsBanner />
          </WSProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
