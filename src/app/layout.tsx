// Root layout. Wires the three brand fonts as CSS variables so any descendant
// can reach them through Tailwind's `font-sans`, `font-serif`, `font-mono`
// utilities (mapping defined in globals.css → @theme inline).
//
// Brand fonts (per BRIEF.md "Stack" section):
//   - Fraunces       → serif, headlines
//   - Inter          → sans, body
//   - JetBrains Mono → mono, eyebrows / labels / code

import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
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

export const metadata: Metadata = {
  title: "MealMate",
  description: "Restaurant discounts in Dallas — diners pay, restaurants pay nothing.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
