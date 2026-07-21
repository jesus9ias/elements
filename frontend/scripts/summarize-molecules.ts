/**
 * summarize-molecules.ts — turns the raw Wikipedia extracts fetched by
 * `fetch-molecules.ts` into each molecule's `description` / `uses`.
 *
 * Local developer tool, run on-demand BY THE DEVELOPER (it calls a paid API —
 * see the monorepo spec's "No external calls without direct authorization").
 * NEVER part of the CI/CD build.
 *
 * EXTRACTION ONLY, exactly like `summarize.ts`: the prompt forbids inventing
 * content and returns null when the source text doesn't cover a field, so the
 * result stays a derivative of the cited Wikipedia article rather than model
 * knowledge. A JSON schema enforces the shape.
 *
 * (The Anthropic call is written out here rather than shared with
 * `summarize.ts`: that script is validated and has already produced the
 * committed element prose, so it is deliberately left untouched.)
 *
 * Usage (reads ANTHROPIC_API_KEY from frontend/.env):
 *   node --env-file=.env --experimental-strip-types scripts/summarize-molecules.ts
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';

import {
  SUMMARIZER_MODEL,
  SUMMARIZER_MAX_TOKENS,
  SUMMARIZER_SOURCE_CHAR_LIMIT,
} from '../src/constants/pipeline.ts';
import { LANGUAGES, type MoleculeLanguage, type RawMolecule } from './fetch-molecules.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(SCRIPT_DIR, '..', 'data', 'raw');
const GENERATED_DIR = path.resolve(SCRIPT_DIR, '..', 'data', 'generated');
const SOURCE_PATH = path.resolve(
  SCRIPT_DIR, '..', 'data', 'curated', 'molecules.source.json',
);

const LANGUAGE_NAMES: Record<MoleculeLanguage, string> = {
  es: 'Spanish',
  en: 'English',
};

const SYSTEM_PROMPT = `You extract information from an encyclopedia article about a chemical compound.

You are an EXTRACTOR, not an author. Absolute rules:
- Use ONLY information explicitly present in the provided source text.
- NEVER add facts from your own knowledge, even if you are certain they are correct.
- If the source text does not cover a field, return null for that field. Returning null is expected and correct — it is far better than guessing.
- Do not speculate, generalize, or infer beyond what the text states.
- Write in the same language as the source text.
- Keep each field to at most three sentences of plain prose, suitable for a general audience. No markdown, no lists, no headings.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    description: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'What the compound is, in general terms.',
    },
    uses: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
      description: 'What the compound is used for in practice.',
    },
  },
  required: ['description', 'uses'],
  additionalProperties: false,
} as const;

export interface SummarizedMolecule {
  description: string | null;
  uses: string | null;
}

interface SourceMolecule {
  id: string;
  i18n: Record<string, { name?: string }>;
}

async function summarizeOne(
  client: Anthropic,
  name: string,
  raw: RawMolecule,
  language: MoleculeLanguage,
): Promise<SummarizedMolecule> {
  const source = (raw.wikipediaExtract ?? '').slice(0, SUMMARIZER_SOURCE_CHAR_LIMIT);
  if (source.trim() === '') {
    return { description: null, uses: null };
  }

  const response = await client.messages.create({
    model: SUMMARIZER_MODEL,
    max_tokens: SUMMARIZER_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Compound: ${name}
Source language: ${LANGUAGE_NAMES[language]}

Source text:
"""
${source}
"""

Extract the two fields from the source text above. Return null for anything the text does not cover.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`No text block returned for ${raw.id} (${language}).`);
  }
  return JSON.parse(textBlock.text) as SummarizedMolecule;
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and populate it, then run with: ' +
        'node --env-file=.env --experimental-strip-types scripts/summarize-molecules.ts',
    );
  }

  const molecules = JSON.parse(await readFile(SOURCE_PATH, 'utf8')) as SourceMolecule[];
  const client = new Anthropic();
  const failures: string[] = [];

  await mkdir(GENERATED_DIR, { recursive: true });

  for (const language of LANGUAGES) {
    const rawPath = path.join(RAW_DIR, `molecules.${language}.json`);
    const raws = JSON.parse(await readFile(rawPath, 'utf8')) as Record<string, RawMolecule>;

    const generated: Record<string, SummarizedMolecule> = {};
    let extracted = 0;

    for (const molecule of molecules) {
      const raw = raws[molecule.id];
      if (!raw) continue;
      const name = molecule.i18n[language]?.name ?? molecule.id;
      try {
        const summary = await summarizeOne(client, name, raw, language);
        generated[molecule.id] = summary;
        if (summary.description || summary.uses) extracted += 1;
      } catch (error) {
        failures.push(
          `${molecule.id} (${language}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const outputPath = path.join(GENERATED_DIR, `molecules.${language}.json`);
    await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
    console.log(
      `[summarize-molecules] ${language}: ${extracted}/${molecules.length} with text ` +
        `-> data/generated/molecules.${language}.json`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Summarization failed for ${failures.length} molecule(s):\n  - ${failures.join('\n  - ')}`,
    );
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(
      '[summarize-molecules] FAILED:',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  });
}
