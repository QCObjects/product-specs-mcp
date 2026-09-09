import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Env,
  SPEC_MAP,
  docsBase,
  fetchPageText,
  fetchSearchIndex,
  scoreDocs,
} from "./docs.js";

const MAX_RESULTS = 8;

export function createServer(env: Env): McpServer {
  const server = new McpServer({
    name: "product-specs-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "list_specs",
    {
      title: "List product specs",
      description:
        "Lists the 16 QCObjects product-spec documents (vision, architecture, core, SDK, CLI, apps, CI, license, pipeline, features, schemas, diagrams, builds, v3 roadmap, add-ons) with their site paths. Start here, then use get_page.",
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text" as const,
          text: Object.entries(SPEC_MAP)
            .map(([n, s]) => `${n} ${s.title}: ${s.path}`)
            .join("\n"),
        },
      ],
    }),
  );

  server.registerTool(
    "search_docs",
    {
      title: "Search product docs",
      description:
        "Full-text search over the published product-specs site (specs, examples, guides). Returns ranked title/location/snippet hits for building QCObjects apps.",
      inputSchema: {
        query: z.string().describe("Search terms, e.g. 'routing hash component'"),
        limit: z.number().int().min(1).max(MAX_RESULTS).optional().describe("Max hits (default 5)"),
      },
    },
    async ({ query, limit }) => {
      const docs = await fetchSearchIndex(env);
      const hits = scoreDocs(docs, query, limit ?? 5);
      const text =
        hits.length === 0
          ? `No matches for "${query}". Try list_specs or broader terms.`
          : hits
              .map((h) => `- ${h.title} (${h.location}) [score ${h.score}]\n  ${h.snippet}`)
              .join("\n");
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.registerTool(
    "get_page",
    {
      title: "Get docs page text",
      description:
        "Fetches a docs page from the published site as plain text (max ~12000 chars). Use a location from search_docs or a path from list_specs.",
      inputSchema: {
        path: z.string().describe("Site-relative path, e.g. '03-core-framework/' or 'examples/npm-install/'"),
      },
    },
    async ({ path }) => {
      const text = await fetchPageText(env, path);
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.registerTool(
    "get_spec",
    {
      title: "Get spec by number",
      description:
        "Fetches one of the 16 numbered product specs (01-16) as plain text. Prefer this over get_page when you know the spec number.",
      inputSchema: {
        number: z.string().describe("Two-digit spec number, e.g. '03' for the core framework spec"),
      },
    },
    async ({ number }) => {
      const key = number.padStart(2, "0");
      const spec = SPEC_MAP[key];
      if (!spec) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown spec "${number}". Use list_specs for 01-16.`,
            },
          ],
          isError: true,
        };
      }
      const text = await fetchPageText(env, spec.path);
      return { content: [{ type: "text" as const, text }] };
    },
  );

  server.registerTool(
    "docs_status",
    {
      title: "Docs source status",
      description: "Returns the docs base URL this server reads from (for debugging/provenance).",
      inputSchema: {},
    },
    async () => ({
      content: [{ type: "text" as const, text: `docs_base: ${docsBase(env)}` }],
    }),
  );

  return server;
}
