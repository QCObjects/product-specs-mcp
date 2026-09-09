import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Env } from "./docs.js";
import { createServer } from "./tools.js";

export interface WorkerEnv extends Env {
  DOCS_BASE_URL?: string;
  INDEX_TTL_SECONDS?: string;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return Response.json({
        name: "product-specs-mcp",
        version: "0.1.0",
        transport: "streamable-http",
        endpoint: "/mcp",
        docs: env.DOCS_BASE_URL ?? "https://qcobjects.github.io/product-specs/",
      });
    }

    if (url.pathname === "/mcp") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed: use POST", { status: 405 });
      }
      const server = createServer(env);
      try {
        const transport = new WebStandardStreamableHTTPServerTransport();
        await server.connect(transport);
        return await transport.handleRequest(request);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json(
          { jsonrpc: "2.0", id: null, error: { code: -32603, message } },
          { status: 500 },
        );
      } finally {
        await server.close?.().catch(() => undefined);
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
