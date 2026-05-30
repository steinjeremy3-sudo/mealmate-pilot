// The image people see in the link-preview card when a Mealmate link is
// shared in a chat (iMessage, WhatsApp, Slack, Discord) or on social.
// Next.js auto-wires this file as og:image (1200×630) for every page,
// since no route overrides it.
//
// Rendered with the brand mark — the "Mealmate :)" wordmark in Archivo
// Black, bone-on-ink, with the paprika tagline. We fetch Archivo Black
// (the display font) so the wordmark matches the site; if that fetch
// ever fails we fall back to the bundled font so a card still renders.

import { ImageResponse } from "next/og";

export const alt = "Mealmate — Your favorite food, for less";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// v2.0 Design Kit palette.
const INK = "#0A0A0A";
const BONE = "#F4EFE3";
const PAPRIKA = "#DA5126";

// Stable raw TTF (satori can't use Google's woff2). Archivo Black ships a
// single weight, which is exactly the display weight the brand uses.
const ARCHIVO_BLACK_TTF =
  "https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf";

async function loadArchivoBlack(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(ARCHIVO_BLACK_TTF);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const fontData = await loadArchivoBlack();
  const fontFamily = fontData ? "Archivo Black" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: INK,
          fontFamily,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            fontSize: 168,
            lineHeight: 1,
            color: BONE,
            letterSpacing: "-7px",
          }}
        >
          <span>Mealmate</span>
          <span style={{ letterSpacing: "-14px" }}>:)</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 48,
            color: PAPRIKA,
            letterSpacing: "-1px",
          }}
        >
          Your favorite food, for less
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData
        ? {
            fonts: [
              {
                name: "Archivo Black",
                data: fontData,
                weight: 400 as const,
                style: "normal" as const,
              },
            ],
          }
        : {}),
    },
  );
}
