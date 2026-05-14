import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata = {
  title: "Agents Assemble — 20 Disease MCP Tester",
  description:
    "Manual testing UI for the Agents Assemble Healthcare MCP server (synthetic data only)."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="brand">Agents Assemble — 20-Disease MCP Tester</div>
          <nav className="nav">
            <Link href="/">Diseases</Link>
            <Link href="/chat">Simple chat</Link>
            <Link href="/report">Report</Link>
            <Link href="/history">History</Link>
            <Link href="/about">About</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
