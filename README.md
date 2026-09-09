# product-specs-mcp

MCP server over the [QCObjects product-specs docs](https://qcobjects.github.io/product-specs/) —
lets AI agents learn framework usage for building apps (specs 01–16 + examples).
Runs on Cloudflare Workers via Streamable HTTP (stateless).

## Tools

| Tool | What it does |
|---|---|
| `list_specs` | Lists all 16 spec docs with site paths |
| `search_docs` | Full-text search over the published site (title-weighted ranking) |
| `get_page` | Fetches a docs page as plain text (~12k chars) |
| `get_spec` | Fetches one numbered spec (01–16) as plain text |
| `docs_status` | Returns the docs base URL (provenance) |

Endpoints: `GET /` (health) · `POST /mcp` (MCP Streamable HTTP).

## How it reads the docs

No vendored content — the Worker fetches the live Pages site at runtime:
`search/search_index.json` for search (cached per isolate, `INDEX_TTL_SECONDS`),
page HTML stripped to text for reads. Override the source with the
`DOCS_BASE_URL` var (e.g. a preview deploy).

## Local dev

```bash
npm ci
npm run check   # tsc + vitest
npm run dev     # wrangler dev (http://127.0.0.1:8787)
```

## Deploy (Cloudflare Workers)

CI deploys `main` automatically. Required GitHub Actions secrets
(repo Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with **Workers Scripts: Edit** on the account (create at dash.cloudflare.com → My Profile → API Tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID (Workers & Pages → Overview, right sidebar) |

Manual deploy: `wrangler login && npm run deploy`.

## Git workflow

Topic branches from `development` (`feature/*`), PR into `development`,
release `development` → `main`. Never rebase. SSH only.
