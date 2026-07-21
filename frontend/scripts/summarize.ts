/**
 * summarize.ts — turns raw Wikipedia extracts into the structured
 * description / uses / characteristics fields, using Claude Haiku.
 *
 * Local developer tool, run on-demand. NEVER part of the CI/CD build and never
 * bundled into the app — it only runs when content actually changes.
 *
 * EXTRACTION ONLY: the prompt forbids inventing content. If a field is not
 * present in the source text the model must return null, which `merge.ts` then
 * turns into `needsReview: true` rather than a plausible-sounding fabrication.
 * A JSON schema (structured outputs) enforces the shape, so a malformed or
 * chatty reply can't slip through.
 *
 * Usage (reads ANTHROPIC_API_KEY from frontend/.env):
 *   node --env-file=.env --experimental-strip-types scripts/summarize.ts --all
 *   node --env-file=.env --experimental-strip-types scripts/summarize.ts --element=Fe
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';

import {
  SUMMARIZER_MODEL,
  SUMMARIZER_MAX_TOKENS,
  SUMMARIZER_SOURCE_CHAR_LIMIT,
} from '../src/constants/pipeline.ts';
import { LANGUAGES, parseCliArgs, type FetchLanguage } from './fetch-elements.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(SCRIPT_DIR, '..', 'data', 'raw');
const GENERATED_DIR = path.resolve(SCRIPT_DIR, '..', 'data', 'generated');

/** Per-language instruction so the output is written in the source language. */
const LANGUAGE_NAMES: Record<FetchLanguage, string> = {
  es: 'Spanish',
  en: 'English',
};

const SYSTEM_PROMPT = `You extract information from an encyclopedia article about a chemical element.

You are an EXTRACTOR, not an author. Absolute rules:
- Use ONLY information explicitly present in the provided source text.
- NEVER add facts from your own knowledge, even if you are certain they are correct.
- If the source text does not cover a field, return null for that field. Returning null is expected and correct — it is far better than guessing.
- Do not speculate, generalize, or infer beyond what the text states.
- Write in the same language as the source text.
- Keep each field to at most three sentences of plain prose. No markdown, no lists, no headings.`;

/** JSON schema forcing the exact shape, with nulls allowed for missing data. */
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    description: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'What the element is, in general terms.',
    },
    uses: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'What the element is used for in practice.',
    },
    characteristics: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'Notable physical or chemical properties.',
    },
  },
  required: ['description', 'uses', 'characteristics'],
  additionalProperties: false,
} as const;

export interface SummarizedElement {
  symbol: string;
  description: string | null;
  uses: string | null;
  characteristics: string | null;
}

interface RawElementFile {
  symbol: string;
  name: string;
  wikipediaExtract: string | null;
}

/** Ask Claude to extract the three fields from one element's source text. */
async function summarizeElement(
  client: Anthropic,
  raw: RawElementFile,
  language: FetchLanguage,
): Promise<SummarizedElement> {
  const source = (raw.wikipediaExtract ?? '').slice(0, SUMMARIZER_SOURCE_CHAR_LIMIT);

  if (source.trim() === '') {
    // No source text at all — every field is legitimately unknown.
    return { symbol: raw.symbol, description: null, uses: null, characteristics: null };
  }

  const response = await client.messages.create({
    model: SUMMARIZER_MODEL,
    max_tokens: SUMMARIZER_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Element: ${raw.name} (${raw.symbol})
Source language: ${LANGUAGE_NAMES[language]}

Source text:
"""
${source}
"""

Extract the three fields from the source text above. Return null for anything the text does not cover.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`No text block returned for ${raw.symbol} (${language}).`);
  }

  const parsed = JSON.parse(textBlock.text) as Omit<SummarizedElement, 'symbol'>;
  return { symbol: raw.symbol, ...parsed };
}

/** Summarize every raw element for one language into data/generated/<lang>/. */
export async function summarizeLanguage(
  client: Anthropic,
  language: FetchLanguage,
  onlySymbol: string | null,
): Promise<{ processed: number; failures: string[] }> {
  const inputDir = path.join(RAW_DIR, language);
  const outputDir = path.join(GENERATED_DIR, language);
  await mkdir(outputDir, { recursive: true });

  const files = (await readdir(inputDir)).filter((file) => file.endsWith('.json'));
  const failures: string[] = [];
  let processed = 0;

  for (const file of files) {
    const raw = JSON.parse(
      await readFile(path.join(inputDir, file), 'utf8'),
    ) as RawElementFile;

    if (onlySymbol && raw.symbol !== onlySymbol) continue;

    try {
      const summary = await summarizeElement(client, raw, language);
      await writeFile(
        path.join(outputDir, `${raw.symbol}.json`),
        `${JSON.stringify(summary, null, 2)}\n`,
        'utf8',
      );
      processed += 1;
    } catch (error) {
      // Collect and keep going, so one bad element doesn't hide the rest.
      failures.push(
        `${raw.symbol} (${language}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { processed, failures };
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.all && !args.element) {
    throw new Error('Specify --all or --element=<symbol>.');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and populate it, ' +
        'then run with: node --env-file=.env --experimental-strip-types scripts/summarize.ts',
    );
  }

  const client = new Anthropic();
  const allFailures: string[] = [];

  for (const language of LANGUAGES) {
    const { processed, failures } = await summarizeLanguage(client, language, args.element);
    console.log(`[summarize] ${language}: wrote ${processed} summary file(s).`);
    allFailures.push(...failures);
  }

  // Fail loudly, listing every offending element, so nothing broken is committed.
  if (allFailures.length > 0) {
    throw new Error(
      `Summarization failed for ${allFailures.length} element(s):\n  - ${allFailures.join('\n  - ')}`,
    );
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error('[summarize] FAILED:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
