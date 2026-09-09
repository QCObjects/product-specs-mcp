import { describe, expect, it, beforeEach } from "vitest";
import {
  SPEC_MAP,
  clearCache,
  docsBase,
  fetchPageText,
  fetchSearchIndex,
  htmlToText,
  scoreDocs,
  type SearchDoc,
} from "../src/docs.js";

const SAMPLE: SearchDoc[] = [
  {
    location: "03-core-framework/",
    title: "Core Framework",
    text: "Components build in the live browser DOM with routing hash pathname search and shadow roots",
  },
  {
    location: "05-cli/",
    title: "CLI",
    text: "The qcobjects create command scaffolds apps with templates",
  },
];

beforeEach(() => clearCache());

describe("docsBase", () => {
  it("defaults to the published Pages site", () => {
    expect(docsBase({})).toBe("https://qcobjects.github.io/product-specs/");
  });
  it("normalizes trailing slash", () => {
    expect(docsBase({ DOCS_BASE_URL: "https://example.com/docs" })).toBe("https://example.com/docs/");
  });
});

describe("SPEC_MAP", () => {
  it("covers specs 01-16", () => {
    for (let n = 1; n <= 16; n++) {
      expect(SPEC_MAP[String(n).padStart(2, "0")]).toBeDefined();
    }
  });
});

describe("scoreDocs", () => {
  it("ranks title matches above body matches", () => {
    const hits = scoreDocs(SAMPLE, "cli");
    expect(hits[0].location).toBe("05-cli/");
  });
  it("finds body terms with snippets", () => {
    const hits = scoreDocs(SAMPLE, "shadow roots");
    expect(hits).toHaveLength(1);
    expect(hits[0].snippet).toContain("shadow");
  });
  it("returns empty for blank queries", () => {
    expect(scoreDocs(SAMPLE, "  ")).toEqual([]);
  });
  it("respects the limit", () => {
    const docs: SearchDoc[] = Array.from({ length: 10 }, (_, i) => ({
      location: `p${i}/`,
      title: `Page ${i} cli`,
      text: "cli cli",
    }));
    expect(scoreDocs(docs, "cli", 3)).toHaveLength(3);
  });
});

describe("htmlToText", () => {
  it("strips scripts/styles/nav and decodes entities", () => {
    const html = `<html><head><style>.a{}</style><script>var x=1;</script></head>
      <body><nav>menu</nav><h1>Title &amp; more</h1><p>Hello <b>world</b></p></body></html>`;
    const text = htmlToText(html);
    expect(text).toContain("Title & more");
    expect(text).toContain("Hello world");
    expect(text).not.toContain("var x");
    expect(text).not.toContain("menu");
  });
});

describe("fetchSearchIndex", () => {
  it("parses docs and caches across calls", async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ docs: SAMPLE }), { status: 200 });
    }) as typeof fetch;
    const env = {};
    const first = await fetchSearchIndex(env, fakeFetch);
    const second = await fetchSearchIndex(env, fakeFetch);
    expect(first).toHaveLength(2);
    expect(second).toBe(first);
    expect(calls).toBe(1);
  });
  it("throws on HTTP errors", async () => {
    const fakeFetch = (async () => new Response("nope", { status: 404 })) as typeof fetch;
    await expect(fetchSearchIndex({}, fakeFetch)).rejects.toThrow("HTTP 404");
  });
});

describe("fetchPageText", () => {
  it("rejects path traversal and absolute URLs", async () => {
    const fakeFetch = (async () => new Response("x")) as typeof fetch;
    await expect(fetchPageText({}, "../secret", fakeFetch)).rejects.toThrow("invalid page path");
    await expect(fetchPageText({}, "https://evil.example/", fakeFetch)).rejects.toThrow("invalid page path");
  });
  it("returns cleaned text", async () => {
    const fakeFetch = (async () =>
      new Response("<html><body><h1>Hi</h1><p>Body text</p></body></html>", { status: 200 })) as typeof fetch;
    const text = await fetchPageText({}, "03-core-framework/", fakeFetch);
    expect(text).toContain("Hi");
    expect(text).toContain("Body text");
  });
  it("truncates long pages", async () => {
    const big = "<html><body><p>" + "x".repeat(20000) + "</p></body></html>";
    const fakeFetch = (async () => new Response(big, { status: 200 })) as typeof fetch;
    const text = await fetchPageText({}, "x/", fakeFetch, 100);
    expect(text.endsWith("[…truncated]")).toBe(true);
  });
});
