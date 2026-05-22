import "./globals.css";
import "../styles/stunning.css";
import "../styles/light-theme.css";
import type { ReactNode } from "react";
import { DM_Sans, Lora, Outfit, Playfair_Display } from "next/font/google";
import { AppShell } from "../components/AppShell";
import { Providers } from "../components/Providers";
import { getDiseaseSummaries } from "../lib/fetch-diseases";

const fontDisplayDark = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-display"
});

const fontBodyDark = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body"
});

const fontDisplayLight = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-lora"
});

const fontBodyLight = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm"
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('aa-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export const metadata = {
  title: "Agents Assemble — Medical Intelligence",
  description:
    "Medical education platform: 20-disease MCP tester, patient chat, report analyzer, synthetic care plans."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const diseases = await getDiseaseSummaries();
  const fontVars = `${fontDisplayDark.variable} ${fontBodyDark.variable} ${fontDisplayLight.variable} ${fontBodyLight.variable}`;

  return (
    <html lang="en" className={fontVars} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>
          <AppShell diseases={diseases}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
