// Root layout. Wires the brand fonts as CSS variables so any descendant
// can reach them through Tailwind's `font-sans`, `font-display`,
// `font-mono` utilities (mapping defined in globals.css → @theme inline).
//
// Brand fonts (per the v2.0 Design Kit):
//   - Archivo Black  → display, wordmark, headlines (single weight)
//   - Inter          → sans, body
//   - JetBrains Mono → mono, labels, eyebrows, prices

import type { Metadata } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// `title` is the page header / browser tab; `description` + the
// openGraph/twitter blocks drive the preview card people see when the
// link is shared (iMessage, WhatsApp, social). None of the public pages
// override these, so this is what every shared link shows.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mealmatedining.app";
const SHARE_TITLE = "Mealmate";
const SHARE_DESCRIPTION = "Your favorite food, for less";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: SHARE_TITLE,
  description: SHARE_DESCRIPTION,
  openGraph: {
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    siteName: SHARE_TITLE,
    url: APP_URL,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
