export type AyurvedaSourceLicense =
  | "public_domain"
  | "cc0"
  | "unknown_or_restricted";

export type AyurvedaSource = {
  /** Stable identifier used in DB slugs + citations. */
  id: string;
  title: string;
  /** Primary human-facing author/editor/translator. */
  author?: string;
  license: AyurvedaSourceLicense;
  /** One or more URLs to fetch (plain text or HTML). */
  urls: string[];
  /** When false, this source is skipped by ingestion. */
  enabledByDefault: boolean;
  /** Notes about provenance/limitations (not shown to users by default). */
  notes?: string;
};

/**
 * Minimal open-source registry for an Ayurveda/Yoga corpus.
 *
 * Important: Only include sources that are clearly public-domain or otherwise
 * permitted for automated downloading/processing in your context.
 */
export const AYURVEDA_SOURCES: AyurvedaSource[] = [
  {
    id: "hatha_yoga_pradipika_pancham_sinh_1914",
    title: "Hatha Yoga Pradipika (tr. Pancham Sinh, 1914)",
    author: "Swatmarama; tr. Pancham Sinh",
    license: "public_domain",
    enabledByDefault: true,
    urls: [
      // Public-domain full text (Internet Archive stream) — avoids 403 blocks from some mirrors.
      "https://archive.org/stream/dli.csl.7087/7087_djvu.txt"
    ],
    notes:
      "Public-domain translation (Pancham Sinh, 1914) mirrored in Internet Archive full-text stream."
  },
  {
    id: "gheranda_samhita_vasu_1914",
    title: "Gheranda Samhita (tr. Srisa Chandra Vasu, 1914–15)",
    author: "Gheranda; tr. Srisa Chandra Vasu",
    license: "public_domain",
    enabledByDefault: true,
    urls: [
      // Public-domain text dump (large but easy to ingest)
      "https://archive.org/stream/Gheranda_Samhita/Gheranda%20samhita_djvu.txt"
    ],
    notes:
      "Public-domain translation; covers shatkarma, asana, mudra, pranayama, dhyana, samadhi."
  },
  {
    id: "ashtanga_hridaya_vagbhata_sanskrit_1939",
    title: "Ashtanga Hridaya of Vagbhata (Sanskrit edition, 1939; with commentaries)",
    author: "Vagbhata",
    license: "public_domain",
    enabledByDefault: false,
    urls: ["https://archive.org/details/Ashtanga.Hridaya.of.Vagbhata"],
    notes:
      "Public-domain Sanskrit edition on Internet Archive. Not enabled by default because extraction quality varies; enable after validating usable text."
  },
  {
    id: "charaka_samhita_wisdomlib_1949",
    title: "Charaka Samhita (English translation, online edition)",
    author: "Caraka (online edition)",
    license: "unknown_or_restricted",
    enabledByDefault: false,
    urls: ["https://www.wisdomlib.org/hinduism/book/charaka-samhita-english"],
    notes:
      "This source is useful, but licensing/terms should be reviewed before automated ingestion. Disabled by default."
  }
];

