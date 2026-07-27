/**
 * merge.ts — combines generated content with curated overrides, field by field.
 *
 * Local developer tool, run on-demand. NEVER part of the CI/CD build.
 *
 * Precedence is per FIELD, not per element: a curated override replaces only
 * the field it defines, so re-running the fetch keeps every other field fresh.
 * Any required field still missing after the merge flags the element with
 * `needsReview: true` rather than shipping a silent gap.
 *
 * Inputs are THREE, not two: `data/raw/` carries the hard data, `data/generated/`
 * the extracted prose, and `data/curated/overrides/` the manual corrections.
 * Overrides win per field; everything else stays fresh on each re-run.
 *
 * Output is ONE aggregate file per language, unlike `fetch-elements.ts`'s
 * one-file-per-element. So a `--element` run cannot just write what it merged:
 * it re-reads the existing config and splices the single record into it. Every
 * other element is carried through untouched.
 *
 * Usage:
 *   node --experimental-strip-types scripts/merge.ts
 *   node --experimental-strip-types scripts/merge.ts --element=Cr
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REQUIRED_ELEMENT_FIELDS } from '../src/constants/elements.ts';
import { categoryFor } from '../src/constants/categories.ts';
import { electronsPerShell } from './electron-configuration.ts';
import {
  SOURCE_LABEL_WIKIDATA,
  SOURCE_LABEL_WIKIPEDIA,
  WIKIDATA_ENTITY_URL_PREFIX,
  WIKIDATA_GENID_PREFIX,
  CONFIRMED_ABSENT,
  LANGUAGE_AGNOSTIC_ELEMENT_FIELDS,
} from '../src/constants/pipeline.ts';
import { LANGUAGES, parseCliArgs, type FetchLanguage } from './fetch-elements.ts';

/** Loosely-typed element shape: pipeline stages may hold partial records. */
export type ElementInput = Record<string, unknown>;

export interface MergedElement extends ElementInput {
  needsReview: boolean;
}

/**
 * A field counts as missing when absent, null, blank, or an empty list.
 * `CONFIRMED_ABSENT` is the one exception: a curated override uses it to
 * assert the field was checked and is genuinely absent, not merely unlooked-at.
 */
function isMissing(value: unknown): boolean {
  if (value === CONFIRMED_ABSENT) return false;
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Downgrades the `CONFIRMED_ABSENT` marker to real `null` for the shipped record. */
function resolveConfirmedAbsent(element: ElementInput): ElementInput {
  const resolved: ElementInput = { ...element };
  for (const [field, value] of Object.entries(resolved)) {
    if (value === CONFIRMED_ABSENT) resolved[field] = null;
  }
  return resolved;
}

/**
 * Merge one element's generated content with its curated overrides.
 * Overrides win per field; `needsReview` is recomputed from the result.
 */
export function mergeElement(
  generated: ElementInput,
  overrides: ElementInput,
): MergedElement {
  const merged: ElementInput = { ...generated };

  // Field-level precedence: an override only replaces the field it defines.
  for (const [field, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      merged[field] = value;
    }
  }

  const needsReview = REQUIRED_ELEMENT_FIELDS.some((field) =>
    isMissing(merged[field]),
  );

  return { ...resolveConfirmedAbsent(merged), needsReview };
}

/** Fields that are still missing — used to report why an element was flagged. */
export function missingRequiredFields(element: ElementInput): string[] {
  return REQUIRED_ELEMENT_FIELDS.filter((field) => isMissing(element[field]));
}

// ---------------------------------------------------------------------------
// CLI runner
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(SCRIPT_DIR, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const GENERATED_DIR = path.join(DATA_DIR, 'generated');
const OVERRIDES_DIR = path.join(DATA_DIR, 'curated', 'overrides');
const ISOTOPES_PATH = path.join(DATA_DIR, 'curated', 'isotopes.json');
const ELECTRON_CONFIG_PATH = path.join(DATA_DIR, 'curated', 'electron-configurations.json');
const CONFIG_DIR = path.resolve(SCRIPT_DIR, '..', 'src', 'config');

/** Matches an ISO-8601 date whose year is CE (no leading minus). */
const CE_YEAR_PATTERN = /^(\d{1,4})-\d{2}-\d{2}/;
/** Matches an ISO-8601 date whose year is BCE (leading minus, per xsd:dateTime). */
const BCE_YEAR_PATTERN = /^-(\d{1,4})-\d{2}-\d{2}/;
/** Matches a bare year, which Wikidata sometimes returns for coarse precision. */
const BARE_YEAR_PATTERN = /^(\d{1,4})$/;

/**
 * Best-effort discovery year. Wikidata's P575 is an ISO timestamp; the app
 * shows a year, so that is what we extract.
 *
 * A BCE year (leading minus) is kept as a negative number, e.g. "-5000" — a
 * plain signed integer, not era text. Rendering it as "5000 antes de nuestra
 * era" / "5000 BCE" is language-dependent and therefore belongs in the i18n
 * layer, never invented by this script.
 */
export function discoveryYear(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  const isoMatch = CE_YEAR_PATTERN.exec(trimmed);
  if (isoMatch?.[1]) return String(Number(isoMatch[1]));

  const bceMatch = BCE_YEAR_PATTERN.exec(trimmed);
  if (bceMatch?.[1]) return String(-Number(bceMatch[1]));

  const bareMatch = BARE_YEAR_PATTERN.exec(trimmed);
  if (bareMatch?.[1]) return String(Number(bareMatch[1]));

  return null;
}

/**
 * P61 (discoverer or inventor) set to Wikidata's "unknown value" resolves
 * through the label service to a blank node's own skolemized IRI, since there
 * is nothing to label. Treat that IRI as absent rather than as a name.
 */
function resolveDiscoverer(raw: string | null): string | null {
  if (!raw) return null;
  return raw.startsWith(WIKIDATA_GENID_PREFIX) ? null : raw;
}

interface RawElementFile {
  atomicNumber: number;
  symbol: string;
  name: string;
  atomicMass: number | null;
  meltingPointC: number | null;
  meltingPointK: number | null;
  boilingPointC: number | null;
  boilingPointK: number | null;
  discoveryDate: string | null;
  discoverer: string | null;
  halfLife: string | null;
  electronConfiguration: string[];
  wikidataId: string;
  wikipediaUrl: string | null;
}

/** Read a JSON file, returning null when it simply isn't there. */
async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new Error(`Could not read ${filePath}: ${(error as Error).message}`);
  }
}

/** Build the attribution entries that double as the "learn more" links. */
function buildSources(raw: RawElementFile, language: FetchLanguage) {
  const sources = [];
  if (raw.wikidataId) {
    sources.push({
      label: SOURCE_LABEL_WIKIDATA,
      url: `${WIKIDATA_ENTITY_URL_PREFIX}${raw.wikidataId}`,
    });
  }
  if (raw.wikipediaUrl) {
    sources.push({
      label: `${SOURCE_LABEL_WIKIPEDIA} (${language})`,
      url: raw.wikipediaUrl,
    });
  }
  return sources;
}

/** Assemble the pre-override record from raw + generated + curated fallbacks. */
function buildElement(
  raw: RawElementFile,
  generated: Record<string, unknown> | null,
  isotopes: string[],
  curatedConfig: string | undefined,
  language: FetchLanguage,
): ElementInput {
  // Prefer the Wikidata claim; fall back to the curated table only when the
  // claim is absent. The curated value is a real spectroscopic notation run
  // through the same parser, so exceptions survive and no rule is applied.
  const electronConfiguration =
    raw.electronConfiguration.length > 0
      ? raw.electronConfiguration
      : electronsPerShell(curatedConfig);

  return {
    atomicNumber: raw.atomicNumber,
    symbol: raw.symbol,
    name: raw.name,
    group: categoryFor(raw.atomicNumber),
    atomicMass: raw.atomicMass,
    meltingPointC: raw.meltingPointC,
    meltingPointK: raw.meltingPointK,
    boilingPointC: raw.boilingPointC,
    boilingPointK: raw.boilingPointK,
    discoveryDate: discoveryYear(raw.discoveryDate),
    discoverer: resolveDiscoverer(raw.discoverer),
    halfLife: raw.halfLife,
    knownIsotopes: isotopes,
    electronConfiguration,
    description: generated?.description ?? null,
    uses: generated?.uses ?? null,
    characteristics: generated?.characteristics ?? null,
    sources: buildSources(raw, language),
  };
}

async function mergeLanguage(
  language: FetchLanguage,
  onlySymbol: string | null,
  isotopesBySymbol: Record<string, string[]>,
  curatedConfigs: Record<string, string>,
): Promise<{ elements: Record<string, MergedElement>; flagged: string[] }> {
  const rawDir = path.join(RAW_DIR, language);
  const files = (await readdir(rawDir)).filter((file) => file.endsWith('.json'));

  const elements: Record<string, MergedElement> = {};
  const flagged: string[] = [];

  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(rawDir, file), 'utf8')) as RawElementFile;
    if (onlySymbol && raw.symbol !== onlySymbol) continue;

    const generated = await readJsonIfPresent<Record<string, unknown>>(
      path.join(GENERATED_DIR, language, `${raw.symbol}.json`),
    );
    const overrides =
      (await readJsonIfPresent<ElementInput>(
        path.join(OVERRIDES_DIR, language, `${raw.symbol}.json`),
      )) ?? {};

    const base = buildElement(
      raw,
      generated,
      isotopesBySymbol[raw.symbol] ?? [],
      curatedConfigs[raw.symbol],
      language,
    );
    const merged = mergeElement(base, overrides);

    elements[String(raw.atomicNumber)] = merged;
    if (merged.needsReview) {
      flagged.push(`${raw.symbol} (${language}): ${missingRequiredFields(merged).join(', ')}`);
    }
  }

  return { elements, flagged };
}

/** Language-agnostic convenience index, derived from the merged records. */
function buildCommon(elements: Record<string, MergedElement>): Record<string, ElementInput> {
  const common: Record<string, ElementInput> = {};
  for (const [atomicNumber, element] of Object.entries(elements)) {
    const entry: ElementInput = {};
    for (const field of LANGUAGE_AGNOSTIC_ELEMENT_FIELDS) {
      entry[field] = element[field];
    }
    common[atomicNumber] = entry;
  }
  return common;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * The config a `--element` run has to splice into. Its absence is not a
 * recoverable case: writing only the scoped record would drop every other
 * element from the shipped file, which is exactly what this guard exists to
 * prevent — so it fails loudly and points at the full run instead.
 */
async function readExistingElements(
  configPath: string,
  language: FetchLanguage,
  symbol: string,
): Promise<Record<string, MergedElement>> {
  const existing = await readJsonIfPresent<Record<string, MergedElement>>(configPath);
  if (!existing) {
    throw new Error(
      `--element=${symbol} splices into src/config/elements.${language}.json, ` +
        'which does not exist yet. Run a full merge (no --element) first.',
    );
  }
  return existing;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const isotopes =
    (await readJsonIfPresent<Record<string, string[]>>(ISOTOPES_PATH)) ?? {};
  const configFile = await readJsonIfPresent<{ configurations?: Record<string, string> }>(
    ELECTRON_CONFIG_PATH,
  );
  const curatedConfigs = configFile?.configurations ?? {};

  await mkdir(CONFIG_DIR, { recursive: true });

  const allFlagged: string[] = [];
  let firstLanguageElements: Record<string, MergedElement> | null = null;

  for (const language of LANGUAGES) {
    const { elements, flagged } = await mergeLanguage(
      language,
      args.element,
      isotopes,
      curatedConfigs,
    );

    if (Object.keys(elements).length === 0) {
      throw new Error(
        `No elements merged for "${language}". Run fetch-elements.ts first` +
          `${args.element ? ` (--element=${args.element})` : ''}.`,
      );
    }

    // A scoped run merged one record; the file it writes holds all of them.
    const configPath = path.join(CONFIG_DIR, `elements.${language}.json`);
    const output = args.element
      ? { ...(await readExistingElements(configPath, language, args.element)), ...elements }
      : elements;

    await writeJson(configPath, output);
    console.log(
      args.element
        ? `[merge] ${language}: spliced ${Object.keys(elements).length} element(s) into` +
            ` ${Object.keys(output).length} in src/config/elements.${language}.json`
        : `[merge] ${language}: wrote ${Object.keys(output).length} element(s) to src/config/elements.${language}.json`,
    );

    // The index is rebuilt from the spliced result, never from the scoped slice.
    firstLanguageElements ??= output;
    allFlagged.push(...flagged);
  }

  // The index is language-agnostic by construction, so either language seeds it.
  if (firstLanguageElements) {
    await writeJson(path.join(CONFIG_DIR, 'common.json'), buildCommon(firstLanguageElements));
    console.log('[merge] wrote src/config/common.json');
  }

  // needsReview is the designed visible-gap mechanism, not a failure — report
  // it in full so the manual review pass starts with the list already made.
  if (allFlagged.length > 0) {
    console.log(`\n[merge] ${allFlagged.length} record(s) flagged needsReview:`);
    for (const entry of allFlagged) {
      console.log(`  - ${entry}`);
    }
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error('[merge] FAILED:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
