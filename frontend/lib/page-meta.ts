export type PageMeta = { title: string; subtitle: string };

export const PAGE_META: Record<string, PageMeta> = {
  "/": {
    title: "Disease Hub",
    subtitle: "All 20 supported detection models — imaging + clinical"
  },
  "/chat": {
    title: "Patient Chat",
    subtitle: "Wikipedia RAG + LLM synthesis · multi-turn conversation"
  },
  "/report": {
    title: "Report Analyzer",
    subtitle: "AI-assisted PDF disease detection & synthetic care plans"
  },
  "/history": {
    title: "Answer History",
    subtitle: "Past Q&A sessions persisted in Postgres database"
  },
  "/about": {
    title: "About & Sources",
    subtitle: "Where every piece of data in this platform comes from"
  }
};

export function metaForPath(pathname: string): PageMeta {
  if (pathname.startsWith("/diseases/")) {
    const slug = pathname.split("/").pop() ?? "";
    const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: name || "Disease",
      subtitle: "Detection → resolution → solution pipeline"
    };
  }
  return PAGE_META[pathname] ?? { title: "Agents Assemble", subtitle: "Medical intelligence platform" };
}
