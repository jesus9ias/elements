/**
 * fetch-elements.ts — pulls structured facts from Wikidata (SPARQL) and raw
 * Wikipedia extracts (ES/EN separately, never machine-translated) into data/raw/.
 *
 * Local developer tool, run on-demand. NEVER part of the CI/CD build.
 *
 * Usage:
 *   node --experimental-strip-types scripts/fetch-elements.ts --all
 *   node --experimental-strip-types scripts/fetch-elements.ts --element=Fe
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ELEMENT_COUNT } from '../src/constants/elements.ts';
import {
  WIKIPEDIA_MAX_ATTEMPTS,
  WIKIPEDIA_RETRY_BASE_DELAY_MS,
  WIKIPEDIA_REQUEST_DELAY_MS,
  RETRYABLE_HTTP_STATUSES,
} from '../src/constants/pipeline.ts';
import { electronsPerShell } from './electron-configuration.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(SCRIPT_DIR, '..', 'data', 'raw');

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'ElementsEducationalApp/0.1 (local content pipeline)';
/** Wikidata unit QIDs used by melting/boiling point claims. */
const UNIT_KELVIN = 'Q11579';
const UNIT_CELSIUS = 'Q25267';
const KELVIN_OFFSET = 273.15;

export const LANGUAGES = ['es', 'en'] as const;
export type FetchLanguage = (typeof LANGUAGES)[number];

export interface CliArgs {
  /** Symbol to scope the run to, or null for a full run. */
  element: string | null;
  /** True when the run covers every element. */
  all: boolean;
}

/** Parse CLI arguments. `--element=<symbol>` scopes the run to one element. */
export function parseCliArgs(argv: string[]): CliArgs {
  let element: string | null = null;
  let all = false;

  for (const arg of argv) {
    const elementMatch = /^--element=(.+)$/.exec(arg);
    if (elementMatch?.[1]) {
      element = elementMatch[1];
      continue;
    }
    if (arg === '--all') {
      all = true;
    }
  }

  return { element, all };
}

const SPARQL_QUERY = `
SELECT ?item ?atomicNumber ?symbol ?mass ?halfLife
       ?melting ?meltingUnit ?boiling ?boilingUnit
       ?discovery ?discovererLabel ?itemLabel ?article
WHERE {
  ?item wdt:P31 wd:Q11344 ;
        wdt:P1086 ?atomicNumber .
  FILTER(?atomicNumber >= 1 && ?atomicNumber <= ${ELEMENT_COUNT})
  OPTIONAL { ?item wdt:P246 ?symbol }
  OPTIONAL { ?item wdt:P2067 ?mass }
  OPTIONAL { ?item wdt:P2114 ?halfLife }
  OPTIONAL { ?item wdt:P575 ?discovery }
  OPTIONAL { ?item wdt:P61 ?discoverer }
  OPTIONAL {
    ?item p:P2101/psv:P2101 [ wikibase:quantityAmount ?melting ; wikibase:quantityUnit ?meltingUnit ]
  }
  OPTIONAL {
    ?item p:P2102/psv:P2102 [ wikibase:quantityAmount ?boiling ; wikibase:quantityUnit ?boilingUnit ]
  }
  OPTIONAL {
    ?article schema:about ?item ; schema:isPartOf <https://LANG.wikipedia.org/> .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "LANG". }
}
`;

/**
 * Electron configuration (P8000) is fetched on its own rather than as another
 * OPTIONAL on the main query.
 *
 * The main query already carries six OPTIONALs, and Wikidata returns the cross
 * product of every combination of their values — elements with several melting
 * point or discoverer statements produce dozens of rows each. On a full 118
 * element run that pushed P8000 out of the result for 54 elements, which
 * surfaced as a silently empty `electronConfiguration` rather than an error.
 * Its own single-purpose query returns one small row per element.
 */
const ELECTRON_CONFIGURATION_QUERY = `
SELECT ?atomicNumber ?electronConfiguration
WHERE {
  ?item wdt:P31 wd:Q11344 ;
        wdt:P1086 ?atomicNumber ;
        wdt:P8000 ?electronConfiguration .
  FILTER(?atomicNumber >= 1 && ?atomicNumber <= ${ELEMENT_COUNT})
}
`;

interface SparqlBinding {
  [key: string]: { value: string } | undefined;
}

/** Run a SPARQL query and return its bindings. */
async function runSparql(query: string, context: string): Promise<SparqlBinding[]> {
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Wikidata SPARQL query failed (${context}): HTTP ${response.status}`);
  }
  const payload = (await response.json()) as {
    results: { bindings: SparqlBinding[] };
  };
  return payload.results.bindings;
}

/** Run the element SPARQL query for one language. */
async function querySparql(language: FetchLanguage): Promise<SparqlBinding[]> {
  return runSparql(SPARQL_QUERY.replaceAll('LANG', language), language);
}

/** Electron configuration per atomic number, from its own query. */
async function queryElectronConfigurations(): Promise<Map<number, string>> {
  const bindings = await runSparql(ELECTRON_CONFIGURATION_QUERY, 'electron configuration');

  const byAtomicNumber = new Map<number, string>();
  for (const binding of bindings) {
    const atomicNumber = Number(binding.atomicNumber?.value);
    const notation = binding.electronConfiguration?.value;
    if (!Number.isInteger(atomicNumber) || !notation) continue;
    // Several elements carry more than one P8000 statement; the first is enough.
    if (!byAtomicNumber.has(atomicNumber)) byAtomicNumber.set(atomicNumber, notation);
  }
  return byAtomicNumber;
}

/** Convert a temperature claim to Celsius + Kelvin, honoring its unit. */
function toTemperatures(
  amount: string | undefined,
  unitUri: string | undefined,
): { celsius: number | null; kelvin: number | null } {
  if (amount === undefined) return { celsius: null, kelvin: null };
  const value = Number(amount);
  if (Number.isNaN(value)) return { celsius: null, kelvin: null };

  const unit = unitUri?.split('/').pop() ?? '';
  if (unit === UNIT_KELVIN) {
    return { celsius: value - KELVIN_OFFSET, kelvin: value };
  }
  if (unit === UNIT_CELSIUS) {
    return { celsius: value, kelvin: value + KELVIN_OFFSET };
  }
  // Unknown unit — surface as missing so merge flags it for review.
  return { celsius: null, kelvin: null };
}

/** Article title as it appears in a Wikipedia URL. */
function titleFromUrl(articleUrl: string | null): string | null {
  if (!articleUrl) return null;
  const title = decodeURIComponent(articleUrl.split('/wiki/').pop() ?? '');
  return title || null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with retry on throttling and transient server errors.
 *
 * A non-OK response used to be swallowed and turned into a null extract, so a
 * throttled run looked successful while losing almost all of its content. Now
 * an exhausted retry budget throws, and the caller reports it.
 */
async function fetchWithRetry(url: URL): Promise<Response> {
  let lastStatus = 0;

  for (let attempt = 0; attempt < WIKIPEDIA_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (response.ok) return response;

    lastStatus = response.status;
    if (!RETRYABLE_HTTP_STATUSES.includes(response.status)) {
      throw new Error(`Wikipedia API returned HTTP ${response.status}`);
    }
    // Exponential backoff: 1s, 2s, 4s…
    await sleep(WIKIPEDIA_RETRY_BASE_DELAY_MS * 2 ** attempt);
  }

  throw new Error(
    `Wikipedia API still returning HTTP ${lastStatus} after ${WIKIPEDIA_MAX_ATTEMPTS} attempts`,
  );
}

interface ExtractsResponse {
  query?: { pages?: Record<string, { extract?: string }> };
}

/** Fetch the full plain-text extract for one article. */
async function fetchExtract(
  title: string,
  language: FetchLanguage,
): Promise<string | null> {
  const api = new URL(`https://${language}.wikipedia.org/w/api.php`);
  api.searchParams.set('action', 'query');
  api.searchParams.set('prop', 'extracts');
  api.searchParams.set('explaintext', '1');
  api.searchParams.set('redirects', '1');
  api.searchParams.set('format', 'json');
  api.searchParams.set('titles', title);

  const response = await fetchWithRetry(api);
  const payload = (await response.json()) as ExtractsResponse;
  const pages = Object.values(payload.query?.pages ?? {});
  return pages[0]?.extract ?? null;
}

/** Shape written to data/raw/<lang>/<symbol>.json. */
export interface RawElement {
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
  wikipediaExtract: string | null;
}

/** How many optional fields a candidate row actually carries. */
function populatedFieldCount(element: RawElement): number {
  const optional = [
    element.atomicMass,
    element.meltingPointC,
    element.boilingPointC,
    element.discoveryDate,
    element.discoverer,
    element.halfLife,
    element.wikipediaUrl,
  ];
  return optional.filter((value) => value !== null).length;
}

function bindingToRawElement(binding: SparqlBinding): RawElement | null {
  const atomicNumber = Number(binding.atomicNumber?.value);
  const symbol = binding.symbol?.value;
  if (!Number.isInteger(atomicNumber) || !symbol) return null;

  const melting = toTemperatures(binding.melting?.value, binding.meltingUnit?.value);
  const boiling = toTemperatures(binding.boiling?.value, binding.boilingUnit?.value);
  const massValue = binding.mass?.value;

  return {
    atomicNumber,
    symbol,
    name: binding.itemLabel?.value ?? symbol,
    atomicMass: massValue === undefined ? null : Number(massValue),
    meltingPointC: melting.celsius,
    meltingPointK: melting.kelvin,
    boilingPointC: boiling.celsius,
    boilingPointK: boiling.kelvin,
    discoveryDate: binding.discovery?.value ?? null,
    discoverer: binding.discovererLabel?.value ?? null,
    halfLife: binding.halfLife?.value ?? null,
    // Filled from its own query in fetchLanguage — see ELECTRON_CONFIGURATION_QUERY.
    electronConfiguration: [],
    wikidataId: binding.item?.value.split('/').pop() ?? '',
    wikipediaUrl: binding.article?.value ?? null,
    wikipediaExtract: null,
  };
}

/** Fetch every element (or a single one) for one language into data/raw/. */
export async function fetchLanguage(
  language: FetchLanguage,
  onlySymbol: string | null,
): Promise<RawElement[]> {
  const bindings = await querySparql(language);
  const configurations = await queryElectronConfigurations();

  // Wikidata may return several statements per element; keep the first complete one.
  const byAtomicNumber = new Map<number, RawElement>();
  for (const binding of bindings) {
    const element = bindingToRawElement(binding);
    if (!element) continue;
    if (onlySymbol && element.symbol !== onlySymbol) continue;

    const existing = byAtomicNumber.get(element.atomicNumber);
    if (!existing) {
      byAtomicNumber.set(element.atomicNumber, element);
      continue;
    }
    // The OPTIONALs make Wikidata return one row per combination of values, so
    // rows for the same element differ in which fields are populated. Keep
    // whichever carries more of them.
    if (populatedFieldCount(element) > populatedFieldCount(existing)) {
      byAtomicNumber.set(element.atomicNumber, element);
    }
  }

  const elements = [...byAtomicNumber.values()].sort(
    (a, b) => a.atomicNumber - b.atomicNumber,
  );

  // Attach the separately-queried electron configurations.
  const missingConfiguration: string[] = [];
  for (const element of elements) {
    const notation = configurations.get(element.atomicNumber);
    element.electronConfiguration = electronsPerShell(notation);
    if (element.electronConfiguration.length === 0) {
      missingConfiguration.push(element.symbol);
    }
  }
  if (missingConfiguration.length > 0) {
    console.warn(
      `[fetch] ${language}: no electron configuration for ${missingConfiguration.length} element(s): ` +
        missingConfiguration.join(', '),
    );
  }

  const outputDir = path.join(RAW_DIR, language);
  await mkdir(outputDir, { recursive: true });

  // One request per element, paced. Failures here throw rather than resolving
  // to null, so a throttled run can never masquerade as a successful one.
  const failedExtracts: string[] = [];
  for (const [index, element] of elements.entries()) {
    const title = titleFromUrl(element.wikipediaUrl);
    if (!title) continue;

    try {
      element.wikipediaExtract = await fetchExtract(title, language);
    } catch (error) {
      failedExtracts.push(
        `${element.symbol}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (index < elements.length - 1) await sleep(WIKIPEDIA_REQUEST_DELAY_MS);
  }

  if (failedExtracts.length > 0) {
    console.warn(
      `[fetch] ${language}: ${failedExtracts.length} extract request(s) failed after retries:`,
    );
    for (const entry of failedExtracts) console.warn(`    - ${entry}`);
  }

  const missingExtracts: string[] = [];

  for (const element of elements) {
    const filePath = path.join(outputDir, `${element.symbol}.json`);

    // Never let a failed fetch overwrite an extract we already had. A partial
    // run should be able to improve the cache, never degrade it.
    if (!element.wikipediaExtract) {
      try {
        const existing = JSON.parse(await readFile(filePath, 'utf8')) as RawElement;
        if (existing.wikipediaExtract) {
          element.wikipediaExtract = existing.wikipediaExtract;
        }
      } catch {
        // No previous file — nothing to preserve.
      }
    }

    if (!element.wikipediaExtract && element.wikipediaUrl) {
      missingExtracts.push(element.symbol);
    }

    await writeFile(filePath, `${JSON.stringify(element, null, 2)}\n`, 'utf8');
  }

  if (missingExtracts.length > 0) {
    console.warn(
      `[fetch] ${language}: no Wikipedia extract for ${missingExtracts.length} element(s): ` +
        missingExtracts.join(', '),
    );
  }

  return elements;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.all && !args.element) {
    throw new Error('Specify --all or --element=<symbol>.');
  }

  for (const language of LANGUAGES) {
    const elements = await fetchLanguage(language, args.element);
    if (elements.length === 0) {
      throw new Error(
        `No elements fetched for "${language}"${args.element ? ` (--element=${args.element})` : ''}.`,
      );
    }
    console.log(`[fetch] ${language}: wrote ${elements.length} element(s) to data/raw/${language}/`);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error('[fetch] FAILED:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
