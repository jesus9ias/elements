/**
 * fetch-molecules.ts — pulls the Wikipedia article text each molecule's prose
 * will be extracted from, into `data/raw/molecules.{lang}.json`.
 *
 * Local developer tool, run on-demand BY THE DEVELOPER (see the monorepo spec's
 * "No external calls without direct authorization" rule). NEVER part of CI/CD.
 *
 * Article titles are never guessed. Each molecule already carries a PubChem CID
 * the developer verified by hand; Wikidata's P662 (PubChem CID) maps that to an
 * item, and the item's sitelinks give the exact ES/EN articles. A molecule with
 * no Wikidata match, or no article in a language, is reported and left without
 * text rather than being resolved by a fuzzy name search.
 *
 * Usage (from `frontend/`):
 *   node --experimental-strip-types scripts/fetch-molecules.ts
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WIKIPEDIA_MAX_ATTEMPTS,
  WIKIPEDIA_RETRY_BASE_DELAY_MS,
  WIKIPEDIA_RATE_LIMIT_DELAY_MS,
  WIKIPEDIA_MAX_BACKOFF_MS,
  MOLECULE_REQUEST_DELAY_MS,
  RETRYABLE_HTTP_STATUSES,
} from '../src/constants/pipeline.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.resolve(
  SCRIPT_DIR, '..', 'data', 'curated', 'molecules.source.json',
);
const RAW_DIR = path.resolve(SCRIPT_DIR, '..', 'data', 'raw');

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'ElementsEducationalApp/0.1 (local content pipeline)';

export const LANGUAGES = ['es', 'en'] as const;
export type MoleculeLanguage = (typeof LANGUAGES)[number];

/** Pull the numeric CID out of a PubChem compound URL. */
const PUBCHEM_CID_PATTERN = /\/compound\/(\d+)/;

interface SourceMolecule {
  id: string;
  sources: { label: string; url: string }[];
  /**
   * Optional escape hatch: an explicit article URL per language, used when
   * Wikidata has no item carrying this molecule's PubChem CID (P662). Curated
   * by hand and always preferred over the automatic lookup.
   */
  wikipedia?: Partial<Record<MoleculeLanguage, string>>;
}

/** Shape written to data/raw/molecules.<lang>.json, keyed by molecule id. */
export interface RawMolecule {
  id: string;
  pubchemCid: string;
  wikipediaUrl: string | null;
  wikipediaExtract: string | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** How long to wait after a retryable response, honoring `Retry-After`. */
function backoffFor(response: Response | null, attempt: number): number {
  const retryAfter = Number(response?.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, WIKIPEDIA_MAX_BACKOFF_MS);
  }
  // Rate limiting needs a much longer pause than a transient server error.
  const base =
    response?.status === 429 ? WIKIPEDIA_RATE_LIMIT_DELAY_MS : WIKIPEDIA_RETRY_BASE_DELAY_MS;
  return Math.min(base * 2 ** attempt, WIKIPEDIA_MAX_BACKOFF_MS);
}

async function fetchWithRetry(url: URL | string, accept?: string): Promise<Response> {
  let lastStatus = 0;

  for (let attempt = 0; attempt < WIKIPEDIA_MAX_ATTEMPTS; attempt += 1) {
    let response: Response | null = null;
    try {
      const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
      if (accept) headers.Accept = accept;
      response = await fetch(url, { headers });
      if (response.ok) return response;
      lastStatus = response.status;
      // A non-retryable status is final — return immediately rather than
      // throwing, which would otherwise be swallowed by this own catch.
      if (!RETRYABLE_HTTP_STATUSES.includes(response.status)) {
        throw new Error(`HTTP ${response.status} (not retryable)`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('not retryable') || attempt === WIKIPEDIA_MAX_ATTEMPTS - 1) {
        throw error;
      }
    }
    if (attempt < WIKIPEDIA_MAX_ATTEMPTS - 1) {
      await sleep(backoffFor(response, attempt));
    }
  }
  throw new Error(`Still failing after ${WIKIPEDIA_MAX_ATTEMPTS} attempts (HTTP ${lastStatus})`);
}

/** CID for a molecule, read from its verified PubChem source link. */
export function pubchemCidFor(molecule: SourceMolecule): string | null {
  for (const source of molecule.sources) {
    const match = PUBCHEM_CID_PATTERN.exec(source.url);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Wikipedia article URLs per language for a set of PubChem CIDs, via Wikidata
 * P662. Returns a map keyed by CID.
 */
async function articlesByCid(
  cids: string[],
): Promise<Map<string, Partial<Record<MoleculeLanguage, string>>>> {
  // VALUES over strings is safe here (P662 is a string property, unlike the
  // numeric quantity properties that need FILTER-based numeric coercion).
  const values = cids.map((cid) => `"${cid}"`).join(' ');
  const query = `
SELECT ?cid ?article WHERE {
  VALUES ?cid { ${values} }
  ?item wdt:P662 ?cid .
  ?article schema:about ?item ;
           schema:isPartOf ?site .
  FILTER(?site = <https://es.wikipedia.org/> || ?site = <https://en.wikipedia.org/>)
}
`;
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`;
  const response = await fetchWithRetry(url, 'application/sparql-results+json');
  const payload = (await response.json()) as {
    results: { bindings: { cid?: { value: string }; article?: { value: string } }[] };
  };

  const byCid = new Map<string, Partial<Record<MoleculeLanguage, string>>>();
  for (const binding of payload.results.bindings) {
    const cid = binding.cid?.value;
    const article = binding.article?.value;
    if (!cid || !article) continue;
    const language: MoleculeLanguage = article.includes('//es.') ? 'es' : 'en';
    const entry = byCid.get(cid) ?? {};
    entry[language] = article;
    byCid.set(cid, entry);
  }
  return byCid;
}

/** Full plain-text extract for one article (one request per title; see spec). */
async function fetchExtract(
  articleUrl: string,
  language: MoleculeLanguage,
): Promise<string | null> {
  const title = decodeURIComponent(articleUrl.split('/wiki/').pop() ?? '');
  if (!title) return null;

  const api = new URL(`https://${language}.wikipedia.org/w/api.php`);
  api.searchParams.set('action', 'query');
  api.searchParams.set('prop', 'extracts');
  api.searchParams.set('explaintext', '1');
  api.searchParams.set('redirects', '1');
  api.searchParams.set('format', 'json');
  api.searchParams.set('titles', title);

  const response = await fetchWithRetry(api);
  const payload = (await response.json()) as {
    query?: { pages?: Record<string, { extract?: string }> };
  };
  const pages = Object.values(payload.query?.pages ?? {});
  return pages[0]?.extract ?? null;
}

async function main(): Promise<void> {
  const molecules = JSON.parse(await readFile(SOURCE_PATH, 'utf8')) as SourceMolecule[];

  const cidByMolecule = new Map<string, string>();
  const withoutCid: string[] = [];
  for (const molecule of molecules) {
    const cid = pubchemCidFor(molecule);
    if (cid) cidByMolecule.set(molecule.id, cid);
    else withoutCid.push(molecule.id);
  }
  if (withoutCid.length > 0) {
    console.warn(`[molecules] no PubChem CID for: ${withoutCid.join(', ')}`);
  }

  const articles = await articlesByCid([...new Set(cidByMolecule.values())]);
  console.log(
    `[molecules] Wikidata resolved articles for ${articles.size}/${cidByMolecule.size} CID(s).`,
  );

  // Name the molecules Wikidata knows nothing about, instead of just a count.
  const pinned = new Set(molecules.filter((m) => m.wikipedia).map((m) => m.id));
  const unresolved = [...cidByMolecule.entries()]
    .filter(([id, cid]) => !articles.has(cid) && !pinned.has(id))
    .map(([id, cid]) => `${id} (CID ${cid})`);
  if (unresolved.length > 0) {
    console.warn(
      `[molecules] no Wikidata item via P662 for: ${unresolved.join(', ')}\n` +
        '  → add a "wikipedia": { "es": "<url>", "en": "<url>" } field to those entries ' +
        'in molecules.source.json to pin the article by hand.',
    );
  }

  await mkdir(RAW_DIR, { recursive: true });
  const failures: string[] = [];

  for (const language of LANGUAGES) {
    const outputPath = path.join(RAW_DIR, `molecules.${language}.json`);

    // Resume: keep whatever a previous run already fetched, so a rate-limited
    // run can simply be re-run until it converges instead of starting over.
    let raw: Record<string, RawMolecule> = {};
    try {
      raw = JSON.parse(await readFile(outputPath, 'utf8')) as Record<string, RawMolecule>;
    } catch {
      /* first run for this language */
    }

    const missing: string[] = [];
    let fetched = 0;

    for (const molecule of molecules) {
      const cid = cidByMolecule.get(molecule.id) ?? '';
      // A hand-curated article wins over the Wikidata lookup.
      const articleUrl =
        molecule.wikipedia?.[language] ?? (cid ? (articles.get(cid)?.[language] ?? null) : null);
      const cached = raw[molecule.id];

      // Never re-fetch text we already have.
      if (cached?.wikipediaExtract) continue;

      let extract: string | null = null;
      if (articleUrl) {
        try {
          extract = await fetchExtract(articleUrl, language);
          fetched += 1;
        } catch (error) {
          failures.push(
            `${molecule.id} (${language}): ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        await sleep(MOLECULE_REQUEST_DELAY_MS);
      }
      if (!extract) missing.push(molecule.id);

      raw[molecule.id] = {
        id: molecule.id,
        pubchemCid: cid,
        wikipediaUrl: articleUrl,
        wikipediaExtract: extract,
      };
    }

    // Always persist, even after failures — a partial run must not lose work.
    await writeFile(outputPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const withText = Object.values(raw).filter((r) => r.wikipediaExtract).length;
    console.log(
      `[molecules] ${language}: ${withText}/${molecules.length} with text ` +
        `(${fetched} fetched this run) -> data/raw/molecules.${language}.json`,
    );
    if (missing.length > 0) {
      console.warn(`[molecules] ${language}: still no text for: ${missing.join(', ')}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n[molecules] ${failures.length} request(s) failed after retries:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('\nEverything fetched so far WAS saved. Re-run to pick up only what is missing.');
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error('[molecules] FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
