"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { fetchCarePlan } from "../lib/api";
import { trainingPill } from "../lib/disease-training-pill";
import type { DiseaseSummary } from "../lib/types";

function SidebarDropdown({
  id,
  label,
  emoji,
  count,
  open,
  onToggle,
  children
}: {
  id: string;
  label: string;
  emoji: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button type="button" className={`ddt${open ? " op" : ""}`} onClick={onToggle} aria-expanded={open} aria-controls={id}>
        <span className="ni-dot" />
        {emoji} {label}
        {count !== undefined ? ` (${count})` : ""}
        <span className="dda" aria-hidden>
          ▶
        </span>
      </button>
      <div className={`ddb${open ? " op" : ""}`} id={id}>
        {children}
      </div>
    </>
  );
}

export function SidebarDiseaseDropdowns({ diseases }: { diseases: DiseaseSummary[] }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const imaging = diseases.filter((d) => d.category === "imaging");
  const clinical = diseases.filter((d) => d.category === "clinical");
  const signal = diseases.filter((d) => d.category === "signal");

  const [open, setOpen] = useState({ img: false, clin: false, sig: false, ml: false });

  async function pickDisease(slug: string, name: string) {
    try {
      const plan = await fetchCarePlan(slug);
      sessionStorage.setItem(
        "stunning_hub_pick",
        JSON.stringify({
          slug,
          name,
          plan,
          hits: [{ slug, name, score: 1, evidence: ["Loaded from sidebar"], evidenceSnippets: [] }]
        })
      );
      router.push("/report?from=hub");
    } catch {
      router.push(`/report?slug=${encodeURIComponent(slug)}`);
    }
  }

  function diseaseActive(slug: string) {
    return pathname === `/diseases/${slug}`;
  }

  function renderDiseaseItem(d: DiseaseSummary) {
    const pill = trainingPill(d);
    return (
      <button
        key={d.slug}
        type="button"
        className={`ni sb-dd-item${diseaseActive(d.slug) ? " on" : ""}`}
        onClick={() => void pickDisease(d.slug, d.name)}
      >
        <span className="ni-dot" />
        <span className="sb-dd-name">{d.name}</span>
        <span className={`tp ${pill.className}`}>{pill.label}</span>
      </button>
    );
  }

  return (
    <>
      <div className="nav-sec-lbl" style={{ marginTop: 6 }}>
        Disease Categories
      </div>

      <SidebarDropdown
        id="dd-img"
        emoji="🔬"
        label="Imaging"
        count={imaging.length}
        open={open.img}
        onToggle={() => setOpen((s) => ({ ...s, img: !s.img }))}
      >
        {imaging.map(renderDiseaseItem)}
      </SidebarDropdown>

      <SidebarDropdown
        id="dd-clin"
        emoji="🩺"
        label="Clinical"
        count={clinical.length}
        open={open.clin}
        onToggle={() => setOpen((s) => ({ ...s, clin: !s.clin }))}
      >
        {clinical.map(renderDiseaseItem)}
      </SidebarDropdown>

      <SidebarDropdown
        id="dd-sig"
        emoji="📡"
        label="Signal"
        count={signal.length}
        open={open.sig}
        onToggle={() => setOpen((s) => ({ ...s, sig: !s.sig }))}
      >
        {signal.map(renderDiseaseItem)}
      </SidebarDropdown>

      <SidebarDropdown
        id="dd-ml"
        emoji="🤖"
        label="ML Sidecar"
        open={open.ml}
        onToggle={() => setOpen((s) => ({ ...s, ml: !s.ml }))}
      >
        <Link href="/about" className="ni">
          <span className="ni-dot" />
          Training status
        </Link>
        <Link href="/about" className="ni">
          <span className="ni-dot" />
          Free API tokens
        </Link>
        <Link href="/about" className="ni">
          <span className="ni-dot" />
          Setup guide
        </Link>
      </SidebarDropdown>
    </>
  );
}
