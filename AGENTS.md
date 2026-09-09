# product-specs-mcp — AGENTS.md

**MCP server repo (TypeScript, Cloudflare Workers).** Exposes the published
product-specs docs as MCP tools so agents learn QCObjects usage for app creation.

## Structure

- `src/index.ts` — Worker entry (`GET /` health, `POST /mcp` Streamable HTTP, stateless)
- `src/tools.ts` — 5 MCP tools (`list_specs`, `search_docs`, `get_page`, `get_spec`, `docs_status`)
- `src/docs.ts` — docs access layer (search-index fetch+cache, keyword scoring, HTML→text)
- `test/docs.test.ts` — vitest unit tests (mocked fetch; 13 tests)
- `wrangler.toml` — Workers config (`account_id` via secret, never committed)

## Conventions

- No vendored docs content — the Worker reads the live Pages site; `DOCS_BASE_URL` overridable
- Stateless transport (no sessions) — every `/mcp` POST is independent
- `SPEC_MAP` (src/docs.ts) MUST track product-specs specs 01–16; update when specs are added
- Strict TS (`tsc --noEmit` must pass); tests must pass (`npm test`)
- `._*` AppleDouble files: deleted on sight, excluded in `vitest.config.ts` + `.gitignore`

## Git workflow

Topic branches from `development`, PR into `development`, release to `main`.
Never rebase. SSH only. CI (`ci.yml`: lint+test) runs on all branches;
`deploy.yml` deploys `main` to Workers using `CLOUDFLARE_API_TOKEN` +
`CLOUDFLARE_ACCOUNT_ID` secrets.

## Verification

```bash
npm run check                       # lint + tests
npx wrangler deploy --dry-run       # bundle check (~1.3MB, ~234KB gzip)
```
