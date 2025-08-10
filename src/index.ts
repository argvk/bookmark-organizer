import 'dotenv/config';
import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';

import { parseXbelToBookmarks, collectFolderNames, type ParsedBookmark } from './xbel.js';
import { normalizeUrl } from './url.js';
import { classifyBookmark, type ClassificationResult } from './classifier.js';
import { buildXbel } from './xbelWriter.js';
import { logger } from './logger.js';

interface UniqueBookmark extends ParsedBookmark {
  urlNormalized: string;
}

function dedupeBookmarks(bookmarks: ParsedBookmark[]): UniqueBookmark[] {
  const urlToBookmark = new Map<string, UniqueBookmark>();
  for (const bm of bookmarks) {
    const normalized = normalizeUrl(bm.url);
    if (!normalized) continue;
    if (!urlToBookmark.has(normalized)) {
      urlToBookmark.set(normalized, { ...bm, urlNormalized: normalized });
    }
  }
  return Array.from(urlToBookmark.values());
}

async function readFileUtf8(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return buf.toString('utf8');
}

async function writeText(filePath: string | undefined, text: string): Promise<void> {
  if (!filePath) {
    process.stdout.write(text + '\n');
    return;
  }
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, text, 'utf8');
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .requiredOption('-i, --input <file>', 'Path to XBEL file')
    .option('-f, --folders <csv>', 'Comma-separated categories; default derives from XBEL folders')
    .option('-o, --out <file>', 'Output XBEL path; default stdout')
    .option('-c, --concurrency <n>', 'Parallel requests', (v: string) => parseInt(v, 10))
    .option('--model <name>', 'OpenAI model (mini)', process.env.OPENAI_MODEL || 'gpt-4o-mini')
    .parse(process.argv);

  const opts = program.opts<{
    input: string;
    folders?: string;
    out?: string;
    concurrency?: number;
    model?: string;
  }>();

  logger.info('Starting classification run');
  logger.debug('CLI options', opts);
  const xml = await readFileUtf8(opts.input);
  const { bookmarks, allFolderPaths } = parseXbelToBookmarks(xml);
  if (bookmarks.length === 0) {
    logger.error('No bookmarks found in XBEL.');
    process.exit(1);
  }

  const unique = dedupeBookmarks(bookmarks);
  logger.info('Loaded bookmarks', { total: bookmarks.length, unique: unique.length });

  const categories = opts.folders
    ? opts.folders.split(',').map((s) => s.trim()).filter(Boolean)
    : Array.from(collectFolderNames(allFolderPaths));

  if (categories.length === 0) {
    logger.error('No categories available. Provide --folders or ensure XBEL has folders.');
    process.exit(1);
  }

  const concurrency = opts.concurrency || Number(process.env.CONCURRENCY || 5);
  const limit = pLimit(concurrency);
  logger.info('Config', { concurrency, model: opts.model });

  const classifyTasks: Array<Promise<ParsedBookmark & ClassificationResult & { urlNormalized: string }>> = unique.map((bm) =>
    limit(async () => {
      logger.debug('Classifying', { title: bm.title, url: bm.url });
      const res = await classifyBookmark({
        title: bm.title,
        url: bm.url,
        path: bm.path,
        categories,
        model: opts.model || 'gpt-4o-mini',
      });
      logger.debug('Result', { title: bm.title, url: bm.url, category: res.chosenCategory, confidence: res.confidence });
      return { ...bm, ...res };
    })
  );

  const results = await Promise.all(classifyTasks);
  const xbel = buildXbel(
    results.map((r: ParsedBookmark & ClassificationResult) => ({ title: r.title, url: r.url, chosenCategory: r.chosenCategory })),
    categories
  );
  await writeText(opts.out, xbel);
  logger.info('Wrote output');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('Unhandled error', message);
  process.exit(1);
});


