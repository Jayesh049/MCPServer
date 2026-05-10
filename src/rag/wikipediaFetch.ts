/**
 * Fetches article intros from Wikipedia's free API (no API key).
 * Respect https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use — educational demo only.
 */
const DEFAULT_ORIGIN = "https://en.wikipedia.org";

function wikiOrigin(): string {
  return (process.env.WIKIPEDIA_API_ORIGIN ?? DEFAULT_ORIGIN).replace(/\/$/, "");
}

function ua(): string {
  return (
    process.env.WIKIPEDIA_USER_AGENT?.trim() ||
    "MCPServer-DynamicRAG/0.1 (local demo; https://github.com/modelcontextprotocol)"
  );
}

export type WikipediaArticleChunk = {
  title: string;
  pageUrl: string;
  excerpt: string;
};

async function wikiGet(params: Record<string, string>): Promise<unknown> {
  const u = new URL(`${wikiOrigin()}/w/api.php`);
  u.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  const res = await fetch(u.toString(), {
    headers: { "User-Agent": ua(), Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Wikipedia API HTTP ${res.status}`);
  }
  return res.json() as Promise<unknown>;
}

export async function searchWikipediaTitles(query: string, limit = 5): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const data = (await wikiGet({
    action: "query",
    list: "search",
    srsearch: q,
    srlimit: String(Math.min(Math.max(limit, 1), 10)),
    utf8: "1"
  })) as {
    query?: { search?: Array<{ title?: string }> };
  };
  const hits = data.query?.search ?? [];
  return hits.map((h) => h.title).filter((t): t is string => typeof t === "string" && t.length > 0);
}

/** Fetch plain-text extracts (intro sections) for one or more titles. */
export async function fetchWikipediaExtracts(titles: string[]): Promise<WikipediaArticleChunk[]> {
  if (!titles.length) return [];
  const pipe = titles.join("|");
  const data = (await wikiGet({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    exintro: "1",
    titles: pipe,
    redirects: "1"
  })) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          extract?: string;
          missing?: boolean;
        }
      >;
    };
  };
  const pages = data.query?.pages ?? {};
  const origin = wikiOrigin();
  const mapped = Object.values(pages)
    .map((p) => {
      const title = p.title ?? "";
      const excerpt = typeof p.extract === "string" ? p.extract.trim() : "";
      if (!title || !excerpt || p.missing) return null;
      const encoded = encodeURIComponent(title.replace(/ /g, "_"));
      return {
        title,
        pageUrl: `${origin}/wiki/${encoded}`,
        excerpt
      };
    })
    .filter((x): x is WikipediaArticleChunk => x !== null);
  return mapped;
}

/**
 * Search Wikipedia, pull intro extracts for top titles, return chunks with citations.
 */
export async function fetchCorpusFromWikipedia(query: string): Promise<WikipediaArticleChunk[]> {
  const titles = await searchWikipediaTitles(query, 5);
  if (!titles.length) return [];
  return fetchWikipediaExtracts(titles);
}
