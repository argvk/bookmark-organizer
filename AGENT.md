### Bookmarks Organiser — Agent Guide

This document equips an automation agent or new contributor with everything needed to build, run, and extend the project.

### What it is

- **Purpose**: CLI to parse XBEL bookmarks, de-duplicate by URL, and auto-categorize using OpenAI (mini model) with structured outputs.
- **Input**: An XBEL XML file containing folders and bookmarks.
- **Output**: An XBEL XML file whose folders correspond to chosen categories and contain the classified bookmarks.

### Tech stack

- **Runtime**: Node.js ≥ 18 (ES2020), ESM (`type: "module"`)
- **Language**: TypeScript
- **Key libraries**:
  - `commander` (CLI), `dotenv` (env), `pino` (logging)
  - `fast-xml-parser` (parse/build XML), `openai@^5` (Responses API + Zod integration), `zod` (schema), `p-limit` (concurrency)

### Repository layout

- `src/index.ts`: CLI entrypoint; orchestrates parse → dedupe → classify → write
- `src/xbel.ts`: Parse XBEL to flat bookmarks and collect folder paths
- `src/url.ts`: URL normalization for deduplication
- `src/classifier.ts`: OpenAI classification with Zod-validated structured output, retry/backoff
- `src/xbelWriter.ts`: Build XBEL from classification results
- `src/logger.ts`: Pino-based logger with `DEBUG` level switch
- `types/env.d.ts`: Declares `process.env` keys for TS
- `Dockerfile`: Multi-stage (builder/runner) image
- `result.xbel`: Example output
- `README.md`: Quick setup and usage
- `package.json`, `tsconfig.json`: Project config

### Environment variables

- `OPENAI_API_KEY` (required): API key for OpenAI
- `OPENAI_MODEL` (optional): Defaults to `gpt-4o-mini`
- `CONCURRENCY` (optional): Number, default `5`
- `DEBUG` (optional): `true`/`1`/`yes` enables debug logs

### Install and build

```bash
npm install
npm run build
# or dev (TS) run
npm run dev -- --input path/to/bookmarks.xbel --folders "Work,Personal" --out result.xbel
```

### CLI usage

```bash
node dist/index.js --input path/to/bookmarks.xbel \
  --folders "Work,Personal,Learning,News" \
  --out result.xbel \
  --concurrency 5 \
  --model gpt-4o-mini
```

- `-i, --input <file>`: Path to input XBEL (required)
- `-f, --folders <csv>`: Comma-separated list of allowed categories; if omitted, categories are derived from folder names found in the XBEL
- `-o, --out <file>`: Output XBEL path; default: stdout
- `-c, --concurrency <n>`: Parallel classifications; default from `CONCURRENCY` or `5`
- `--model <name>`: OpenAI model; default from `OPENAI_MODEL` or `gpt-4o-mini`

### High-level flow

1. Read XBEL and parse to flat list of `{ title, url, path }` (`parseXbelToBookmarks`)
2. De-duplicate by normalized URL (`normalizeUrl`) to a unique set
3. Determine categories: from `--folders` or derived from folder names present in input
4. Classify each unique bookmark concurrently via OpenAI with structured output (`classifyBookmark`)
5. Build an XBEL with folders per category containing the classified bookmarks (`buildXbel`)
6. Write to `--out` or stdout

### Module responsibilities and key behaviors

- `src/index.ts`
  - Uses `commander` to parse CLI options
  - Dedupe: keeps the first seen normalized URL only
  - Concurrency via `p-limit`; default equals env `CONCURRENCY` or `5`
  - Logs: info always; debug when `DEBUG` enabled
  - Exits with non-zero when: no bookmarks, or no categories available

- `src/xbel.ts`
  - Parsing via `fast-xml-parser` with `ignoreAttributes: false` and `@_` prefix
  - Extracts bookmarks at root and within nested folders
  - `path` is the slash-joined hierarchical folder path (e.g., `Parent/Child`)
  - `collectFolderNames` flattens all path segments to a unique set of category candidates

- `src/url.ts`
  - Normalization rules:
    - Lowercase protocol and hostname
    - Drop default ports (`http:80`, `https:443`); keep non-default ports
    - Ensure path has no trailing slash (unless root)
    - Sort query parameters by key; preserve hash
  - Returns empty string on invalid URLs, which effectively skips that bookmark during dedupe

- `src/classifier.ts`
  - Requires `OPENAI_API_KEY`
  - System guidance instructs a single best category chosen from a provided allowed list
  - Uses OpenAI Responses API with Zod (`zodTextFormat`) for structured output:
    - Schema: `{ chosenCategory: z.enum(allowedCategories), confidence: number 0..1 }`
    - If structured parse fails, attempts `output_text` JSON parse; otherwise defaults `chosenCategory` to the first allowed category and `confidence` to `0`
  - Retry/backoff (`withRetries`) for 429/5xx/unknown status with exponential backoff and jitter; logs 5xx payloads at debug/error appropriately

- `src/xbelWriter.ts`
  - Groups by `chosenCategory`
  - Includes only categories that have at least one bookmark, unless an explicit list is provided (then all categories are emitted, empty ones filtered out)
  - Pretty-prints XBEL (`format: true`, `indentBy: '  '`) and sets `@_version: '1.0'`

- `src/logger.ts`
  - Thin wrapper around `pino` to support `logger.info/debug/error(message, meta?)`
  - `DEBUG=true|1|yes` switches level to `debug`

### Docker

- Multi-stage build for reproducible production image
- Runs as non-root user `app`
- Entrypoint: `node dist/index.js`

Build and run:

```bash
docker build -t bookmarks-organiser .
docker run --rm \
  -e OPENAI_API_KEY=your_key \
  -e OPENAI_MODEL=gpt-4o-mini \
  -v "$(pwd)":/data \
  bookmarks-organiser \
  --input /data/bookmarks.xbel --folders "Work,Personal" --out /data/result.xbel
```

### Development

- Scripts:
  - `npm run build`: TypeScript compile to `dist` (ESM, source maps)
  - `npm run start`: Run built CLI (`node --enable-source-maps dist/index.js`)
  - `npm run dev`: Run TS directly with `tsx`
- TS config: ESM (`NodeNext`), `strict: true`, `rootDir: src`, `outDir: dist`, `sourceMap: true`

### Example output

- See `result.xbel` for a real sample categorized into `Work` and `Personal`.

### Troubleshooting

- "Missing OPENAI_API_KEY": Ensure the env var is set (shell or Docker `-e`)
- "No bookmarks found in XBEL": Input file likely empty or malformed
- "No categories available": Provide `--folders` or ensure XBEL contains folders
- Rate limiting / 5xx: The client retries with exponential backoff; adjust `--concurrency` downward if needed and/or enable `DEBUG` to inspect logs
- Debugging: Set `DEBUG=true` to see input/output payload summaries (sensitive data like full API key is never logged)

### Design choices and constraints

- Deduplication favors the first encountered URL after normalization
- Classification context includes `title`, `url`, and the bookmark's folder `path`
- Categories are a closed set for each run (Zod `enum` enforces allowed values)
- Concurrency is bounded and retried to respect rate limits; no request caching is implemented

### Extensibility ideas

- Output formats: add JSON/CSV export alongside XBEL
- Caching: memoize classifications by normalized URL to reduce cost
- Enrichment: include page metadata (fetch `<title>`/OpenGraph) to improve classification
- Config file: accept a config YAML/JSON instead of long CLI flags
- Fine-grained categories: support hierarchical category selection or alias maps

### Notes for agents

- Always set `OPENAI_API_KEY` before running
- Prefer `--folders` to ensure a stable category set; otherwise categories are inferred from input folder names
- When automating, pass non-interactive flags only; the CLI is non-interactive by design
- The process writes to stdout if `--out` is omitted; capture output as needed

### License and authorship

- No license file present; assume all rights reserved unless a license is added


