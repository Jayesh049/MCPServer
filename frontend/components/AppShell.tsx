"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { metaForPath } from "../lib/page-meta";
import { ThemeToggle, useTheme } from "../lib/theme";
import type { DiseaseSummary } from "../lib/types";

const MAIN_NAV = [
  { href: "/", label: "Disease Hub", match: (p: string) => p === "/" },
  { href: "/chat", label: "Patient Chat", match: (p: string) => p.startsWith("/chat") },
  { href: "/report", label: "Report Analyzer", match: (p: string) => p.startsWith("/report") },
  { href: "/history", label: "History", match: (p: string) => p.startsWith("/history") },
  { href: "/about", label: "About & Sources", match: (p: string) => p.startsWith("/about") }
];

const TOP_TABS = [
  { href: "/", label: "Diseases" },
  { href: "/chat", label: "Chat" },
  { href: "/report", label: "Report" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About" }
];

export function AppShell({
  diseases,
  children
}: {
  diseases: DiseaseSummary[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const meta = metaForPath(pathname);
  const { theme } = useTheme();
  const imaging = diseases.filter((d) => d.category === "imaging");
  const clinical = diseases.filter((d) => d.category === "clinical");
  const brandIcon = theme === "light" ? "🌿" : "🧬";

  return (
    <div className="stunning-app">
      <div className="bg-mesh" aria-hidden />
      <div className="stunning-shell">
        <aside className="stunning-sb" aria-label="Section navigation">
          <div className="sb-scan" aria-hidden />
          <div className="sb-logo">
            <Link className="brand" href="/">
              <div className="brand-mark">{brandIcon}</div>
              <div>
                <div className="brand-name">
                  Agents
                  <br />
                  Assemble
                </div>
                <div className="brand-tag">Medical Intelligence</div>
              </div>
            </Link>
          </div>

          <nav className="sb-nav">
            <div className="nav-sec">
              <div className="nav-sec-lbl">Navigation</div>
              {MAIN_NAV.map((item) => {
                const on = item.match(pathname);
                return (
                  <Link key={item.href} href={item.href} className={`ni${on ? " on" : ""}`}>
                    <span className="ni-dot" />
                    {item.label}
                    {item.href === "/" ? <span className="ni-badge">{diseases.length || "—"}</span> : null}
                  </Link>
                );
              })}
            </div>

            <div className="nav-sec">
              <div className="nav-sec-lbl">Imaging</div>
              {imaging.slice(0, 6).map((d) => (
                <Link key={d.slug} href={`/diseases/${d.slug}`} className="ni">
                  <span className="ni-dot" />
                  {d.name}
                </Link>
              ))}
            </div>

            <div className="nav-sec">
              <div className="nav-sec-lbl">Clinical</div>
              {clinical.slice(0, 6).map((d) => (
                <Link key={d.slug} href={`/diseases/${d.slug}`} className="ni">
                  <span className="ni-dot" />
                  {d.name}
                </Link>
              ))}
            </div>
          </nav>

          <div className="sb-foot">
            <div className="status-row">
              <span className="status-dot" />
              <span className="status-txt">MCP Tester Active</span>
            </div>
          </div>
        </aside>

        <div className="stunning-mn">
          <header className="stunning-tb">
            <div>
              <div className="tb-title">{meta.title}</div>
              <div className="tb-sub">{meta.subtitle}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <ThemeToggle />
              <div className="tab-row" role="tablist" aria-label="Primary sections">
                {TOP_TABS.map((tab) => {
                  const on =
                    tab.href === "/"
                      ? pathname === "/"
                      : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                  return (
                    <Link key={tab.href} href={tab.href} className={`tab${on ? " on" : ""}`} role="tab">
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="stunning-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
