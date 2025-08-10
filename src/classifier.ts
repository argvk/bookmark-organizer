import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat, zodTextFormat } from 'openai/helpers/zod';
import { logger } from './logger.js';

export interface ClassificationResult {
  chosenCategory: string;
  confidence: number;
}

type ClassifyInput = {
  title: string;
  url: string;
  path: string;
  categories: string[];
  model?: string;
};

async function withRetries<T>(
  fn: () => Promise<T>,
  {
    retries = 4,
    baseMs = 400,
    onServerError,
  }: { retries?: number; baseMs?: number; onServerError?: (err: any) => void } = {}
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      if (attempt > 0) {
        logger.debug('Retrying after backoff', { attempt });
      }
      return await fn();
    } catch (err: any) {
      attempt += 1;
      const status: number | undefined = err?.status || err?.response?.status;
      const isRetryable = status === 429 || (status !== undefined && status >= 500 && status < 600) || status === undefined;
      if (status !== undefined && status >= 500 && status < 600) {
        try {
          onServerError?.(err);
        } catch {}
      }
      if (!isRetryable || attempt > retries) throw err;
      const delay = Math.round(baseMs * Math.pow(2, attempt - 1) + Math.random() * 100);
      logger.debug('Retryable error; backing off', { attempt, status, delayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function classifyBookmark({ title, url, path, categories, model = 'gpt-4o-mini' }: ClassifyInput): Promise<ClassificationResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY');
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Structured output enforced via Zod schema and zodResponseFormat

  const system = [
    'You are a bookmark classifier.',
    'Pick the single best category from the allowed list.',
    'Be flexible: if multiple categories could fit, choose the closest match.',
    'If unsure, pick the most semantically similar category, not "Other" unless it exists.'
  ].join(' ');

  const input = [
    `Title: ${title}`,
    `URL: ${url}`,
    `Folder path (context): ${path || '(none)'}\n`,
    `Allowed categories: ${categories.join(', ')}`
  ].join('\n');

  const BookmarkCategory = z.object({
    chosenCategory: z.enum(categories as [string, ...string[]]),
    confidence: z.number().min(0).max(1)
  });

  const requestPayload = {
    model,
    input: [
      { role: 'developer', content: system },
      { role: 'user', content: input }
    ],
    // temperature: 0.1,
    // max_output_tokens: 150,
    text: {
      format: zodTextFormat(BookmarkCategory, 'bookmark_category')
    }
  } as const;

  const response = await withRetries(
    () => client.responses.parse(requestPayload as any),
    {
      onServerError: (err: any) => {
        const status: number | undefined = err?.status || err?.response?.status;
        const responseBody: unknown = err?.response?.data ?? err?.response?.body ?? err?.data ?? err?.body ?? err?.message ?? err;
        logger.error('OpenAI 5xx error', {
          status,
          requestBody: requestPayload,
          responseBody,
        });
      },
    }
  );

  // Debug-log successful response payload as well
  try {
    const successBody: unknown = {
      output_parsed: (response as any)?.output_parsed,
      output_text: (response as any)?.output_text,
    };
    logger.debug('OpenAI success', {
      requestBody: requestPayload,
      responseBody: successBody,
    });
  } catch {}

  let parsed = (response as any)?.output_parsed as z.infer<typeof BookmarkCategory> | undefined;
  if (!parsed) {
    const textOut: string | undefined = (response as any)?.output_text;
    if (textOut) {
      try {
        const obj = JSON.parse(textOut);
        const safe = BookmarkCategory.safeParse(obj);
        if (safe.success) parsed = safe.data;
        else logger.debug('Failed to parse structured output; will fallback', { textOut });
      } catch {}
    }
  }

  const chosenCategory = (parsed?.chosenCategory as string | undefined) ?? categories[0];
  return {
    chosenCategory,
    confidence: parsed?.confidence ?? 0,
  };
}


