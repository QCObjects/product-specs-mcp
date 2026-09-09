/**
 * Docs access layer: consumes the published product-specs site
 * (MkDocs Material build) over HTTPS. No filesystem — all state is
 * fetched at runtime and cached in module scope (per isolate).
 */

export interface Env {
  DOCS_BASE_URL?: string;
  INDEX_TTL_SECONDS?: string;
}

export interface SearchDoc {
  location: string;
  title: string;
  text: string;
}

interface Cached<T> {
  at: number;
  value: T;
}

let indexCache: Cached<SearchDoc[]> | null = null;

export function docsBase(env: Env): string {
  const raw = env.DOCS_BASE_URL ?? "https://qcobjects.github.io/product-specs/";
  return raw.endsWith("/") ? raw : raw + "/";
}

function ttlMs(env: Env): number {
  const s = parseInt(env.INDEX_TTL_SECONDS ?? "3600", 10);
  return (Number.isFinite(s) && s > 0 ? s : 3600) * 1000;
}

/** Curated top-level map: spec number -> site path. Mirrors product-specs README. */
export const SPEC_MAP: Record<string, { path: string; title: string }> = {
  "01": { path: "01-product-vision/", title: "Product Vision" },
  "02": { path: "02-architecture/", title: "Architecture" },
  "03": { path: "03-core-framework/", title: "Core Framework" },
  "04": { path: "04-sdk/", title: "SDK" },
  "05": { path: "05-cli/", title: "CLI" },
  "06": { path: "06-app-structure/", title: "App Structure" },
  "07": { path: "07-app-templates/", title: "App Templates" },
  "08": { path: "08-ci-conventions/", title: "CI Conventions" },
  "09": { path: "09-license/", title: "License" },
  "10": { path: "10-contribution-pipeline/", title: "Contribution Pipeline" },
  "11": { path: "11-features/", title: "Features" },
  "12": { path: "12-schemas/", title: "Schemas" },
  "13": { path: "13-diagrams/", title: "Diagrams" },
  "14": { path: "14-build-scripts-blueprint/", title: "Build Scripts Blueprint" },
  "15": { path: "15-unified-vision-v3/", title: "Unified Vision v3.0" },
  "16": { path: "16-addons/", title: "Add-ons" },
};

export async function fetchSearchIndex(env: Env, fetchFn: typeof fetch = fetch): Promise<SearchDoc[]> {
  const now = Date.now();
  if (indexCache && now - indexCache.at < ttlMs(env)) return indexCache.value;
  const res = await fetchFn(docsBase(env) + "search/search_index.json");
  if (!res.ok) throw new Error(`search index fetch failed: HTTP ${res.status}`);
  const data = (await res.json()) as { docs?: SearchDoc[] };
  const docs = Array.isArray(data.docs) ? data.docs : [];
  indexCache = { at: now, value: docs };
  return docs;
}

export function clearCache(): void {
  indexCache = null;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9_.$]+/)
    .filter((t) => t.length > 1);
}

export interface SearchHit {
  location: string;
  title: string;
  snippet: string;
  score: number;
}

export function scoreDocs(docs: SearchDoc[], query: string, limit = 5): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const d of docs) {
    const titleTokens = tokenize(d.title ?? "");
    const text = (d.text ?? "").replace(/\s+/g, " ");
    const textLower = text.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (titleTokens.includes(t)) score += 5;
      else if (titleTokens.some((x) => x.includes(t) || t.includes(x))) score += 2;
      const occurrences = textLower.split(t).length - 1;
      if (occurrences > 0) score += Math.min(occurrences, 5);
    }
    if (score > 0) {
      const firstTerm = terms.find((t) => textLower.includes(t)) ?? terms[0];
      const idx = Math.max(0, textLower.indexOf(firstTerm) - 120);
      hits.push({
        location: d.location,
        title: d.title,
        snippet: text.slice(idx, idx + 320),
        score,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Strip a rendered docs page to agent-readable plain text. */
export function htmlToText(html: string): string {
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  out = out
    .replace(/<(h[1-6]|p|div|li|tr|section|article)[^>]*>/gi, "\n$&")
    .replace(/<[^>]+>/g, " ");
  return out
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export async function fetchPageText(
  env: Env,
  pagePath: string,
  fetchFn: typeof fetch = fetch,
  maxChars = 12000,
): Promise<string> {
  const clean = pagePath.replace(/^\/+/, "");
  if (clean.includes("..") || clean.startsWith("http")) {
    throw new Error("invalid page path");
  }
  const res = await fetchFn(docsBase(env) + clean);
  if (!res.ok) throw new Error(`page fetch failed: HTTP ${res.status} for ${clean}`);
  const text = htmlToText(await res.text());
  return text.length > maxChars ? text.slice(0, maxChars) + "\n\n[…truncated]" : text;
}
