### Bookmarks Organiser

CLI to parse XBEL bookmarks, de-duplicate by URL, and auto-categorize using OpenAI (mini model) with flexible queries.

## Setup

1. Ensure Node.js >= 18
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with:

```env
OPENAI_API_KEY=your_key_here
# Optional tuning
OPENAI_MODEL=gpt-4o-mini
CONCURRENCY=5
# Enable verbose debug logs (info logs are always printed)
DEBUG=true
```

## Usage

```bash
# XBEL output
node dist/index.js --input path/to/bookmarks.xbel --folders "Work,Personal,Learning,News" --out result.xbel
```

- `--input` or `-i`: Path to XBEL file
- `--folders` or `-f`: Comma-separated allowed categories (optional; defaults to folders found in XBEL)
- `--out` or `-o`: Output JSON path (default: stdout)
- `--concurrency` or `-c`: Parallel requests (default from env `CONCURRENCY` or 5)

## Output

- **XBEL**: folders named by `chosenCategory`, each containing the bookmarks classified into that category.

## Docker

Build image:

```bash
docker build -t bookmarks-organiser .
```

Run (mount local data directory, provide API key):

```bash
docker run --rm \
  -e OPENAI_API_KEY=your_key_here \
  -e OPENAI_MODEL=gpt-4o-mini \
  -v "$(pwd)":/data \
  bookmarks-organiser \
  --input /data/bookmarks.xbel --folders "Work,Personal" --out /data/result.xbel
```

## Notes
- De-duplication normalizes URL (protocol/host lowercased, trailing slashes removed).
- Classification uses OpenAI structured output to select one category from allowed set.
- Requests run concurrently with retry and backoff.
- Set `DEBUG=true` (or `1`/`yes`) to see debug logs; otherwise only info/error are printed.


