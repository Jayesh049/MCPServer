import "./globals.css";
import type { ReactNode } from "react";
import { DM_Mono, DM_Serif_Display, Outfit } from "next/font/google";
import { AppShell } from "../components/AppShell";
import { Starfield } from "../components/Starfield";
import { getDiseaseSummaries } from "../lib/fetch-diseases";

const fontDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display"
});

const fontBody = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body"
});

const fontMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

export const metadata = {
  title: "Agents Assemble — 20 Disease MCP Tester",
  description:
    "Manual testing UI for the Agents Assemble Healthcare MCP server (synthetic data only)."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const diseases = await getDiseaseSummaries();
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <body>
        <Starfield />
        <AppShell diseases={diseases}>{children}</AppShell>
      </body>
    </html>
  );
}
