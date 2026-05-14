"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DiseaseSummary } from "../lib/types";

const nav = [
  { href: "/", label: "Diseases", match: (p: string) => p === "/" },
  { href: "/chat", label: "Patient Chat", match: (p: string) => p.startsWith("/chat") },
  { href: "/report", label: "Report Analyzer", match: (p: string) => p.startsWith("/report") },
  { href: "/history", label: "History", match: (p: string) => p.startsWith("/history") },
  { href: "/about", label: "About", match: (p: string) => p.startsWith("/about") }
];

function IconDiseases() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M3 9h3M18 9h3M3 15h3M18 15h3M9 3v3M9 18v3M15 3v3M15 18v3" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconReport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconAbout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

const topIcons: Record<string, React.ReactNode> = {
  "/": <IconDiseases />,
  "/chat": <IconChat />,
  "/report": <IconReport />,
  "/history": <IconHistory />,
  "/about": <IconAbout />
};

function categoryDot(category: DiseaseSummary["category"]): string {
  if (category === "imaging") return "#5b8dff";
  if (category === "clinical") return "#f5c76e";
  return "#3ddba0";
}

export function AppShell({
  diseases,
  children
}: {
  diseases: DiseaseSummary[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const imaging = diseases.filter((d) => d.category === "imaging");
  const clinical = diseases.filter((d) => d.category === "clinical");
  const signal = diseases.filter((d) => d.category === "signal");

  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-icon" aria-hidden>
            ⚕
          </span>
          Agents Assemble
          <sup>MCP</sup>
        </Link>
        <div className="topbar-divider" />
        <nav className="nav" aria-label="Primary">
          {nav.map((item) => {
            const active = item.match(pathname);
            return (
              <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                {topIcons[item.href]}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="topbar-actions">
          <div className="badge-live">MCP Tester Active</div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar" aria-label="Section navigation">
          <div className="sidebar-section-title">Navigation</div>
          <Link
            href="/"
            className={`sidebar-item${pathname === "/" ? " active" : ""}`}
          >
            <IconHome />
            Disease Hub
            <span className="count">{diseases.length || "—"}</span>
          </Link>
          <Link href="/chat" className={`sidebar-item${pathname.startsWith("/chat") ? " active" : ""}`}>
            <IconChat />
            Patient Chat
          </Link>
          <Link href="/report" className={`sidebar-item${pathname.startsWith("/report") ? " active" : ""}`}>
            <IconReport />
            Report Analyzer
          </Link>
          <Link href="/history" className={`sidebar-item${pathname.startsWith("/history") ? " active" : ""}`}>
            <IconHistory />
            History
          </Link>

          <div className="sidebar-section-title">Imaging</div>
          {imaging.slice(0, 8).map((d) => (
            <Link key={d.slug} href={`/diseases/${d.slug}`} className="sidebar-disease">
              <span className="dot" style={{ background: categoryDot(d.category) }} />
              {d.name}
            </Link>
          ))}

          <div className="sidebar-section-title">Clinical</div>
          {clinical.slice(0, 8).map((d) => (
            <Link key={d.slug} href={`/diseases/${d.slug}`} className="sidebar-disease">
              <span className="dot" style={{ background: categoryDot(d.category) }} />
              {d.name}
            </Link>
          ))}

          <div className="sidebar-section-title">Signal</div>
          {signal.map((d) => (
            <Link key={d.slug} href={`/diseases/${d.slug}`} className="sidebar-disease">
              <span className="dot" style={{ background: categoryDot(d.category) }} />
              {d.name}
            </Link>
          ))}
        </aside>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
