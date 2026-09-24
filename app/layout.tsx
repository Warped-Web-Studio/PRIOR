import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Display and text: a variable grotesk that holds up at 200 weight and
// 9rem — the lightness carries the luxury, not a borrowed serif.
const display = Hanken_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Data, coordinates, edition numbers: the voice of the laboratory report.
const mono = IBM_Plex_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PRIOR — Water from beneath the Ansel Shelf",
  description:
    "Glacial aquifer water, sealed 11,400 years beneath basalt. Drawn fourteen days a year. 2,400 bottles. A concept by Warped Web Studio.",
};

export const viewport: Viewport = {
  themeColor: "#050607",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
