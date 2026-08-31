import type { Metadata } from "next";
import { Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Sankhya Kaushal · MoSPI NSTA",
  description: "Capacity building platform for India's Official Statistical System.",
};

// Supabase lives in ap-south-1 (Mumbai); collocate function execution there
// too (see vercel.json's "regions") instead of Vercel's US-East default -
// every DB call otherwise pays a transcontinental round trip.
export const preferredRegion = "bom1";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
