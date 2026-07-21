/**
 * fetch-isotopes.ts — seeds `data/curated/isotopes.json` from Wikidata.
 *
 * Local developer tool, run on-demand BY THE DEVELOPER. Never part of the
 * CI/CD build, and never executed by Claude Code (see the monorepo spec's
 * "No external calls without direct authorization" rule).
 *
 * This is a ONE-TIME SEEDING job, not part of the regular element pipeline.
 * Its output is a curated file: run it once, review what it produced, correct
 * by hand what needs correcting, and commit. `merge.ts` then just reads it.
 *
 * Scope: NATURALLY OCCURRING isotopes, i.e. those carrying a natural-abundance
 * claim (P2374). That matches the spec's own Data Model example, where iron
 * lists Fe-54/56/57/58 — its natural isotopes, not all ~30 known ones.
 *
 * ---------------------------------------------------------------------------
 * FIRST RUN IS A PROBE. Wikidata models isotopes as separate items rather than
 * as a claim on the element, and the property linking the two is not something
 * this script can verify without running. If the run reports zero isotopes for
 * every element, the linking pattern below is wrong rather than the data being
 * absent — report the output and the query gets corrected, no harm done since
 * nothing is written unless results come back.
 * ---------------------------------------------------------------------------
 *
 * Usage:
 *   node --experimental-strip-types scripts/fetch-isotopes.ts --probe
 *   node --experimental-strip-types scripts/fetch-isotopes.ts
 *
 * Run `--probe` FIRST. It asks Wikidata how it actually models a known isotope
 * (iron-56) and prints every claim on that item, which reveals both its
 * `instance of` class and the property linking it back to the element. That
 * removes the guesswork the seeding query depends on.
 */

import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ELEMENT_COUNT } from '../src/constants/elements.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(SCRIPT_DIR, '..', 'data', 'curated', 'isotopes.json');

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'ElementsEducationalApp/0.1 (local content pipeline)';

/** Separator used inside GROUP_CONCAT, chosen not to appear in any label. */
const CONCAT_SEPARATOR = '|';

/** Isotope labels read as "iron-56"; we keep the mass number from the suffix. */
const MASS_NUMBER_PATTERN = /-(\d+)$/;

/**
 * Model confirmed by the probe (2026-07-18): an isotope is `subclass of` (P279)
 * its element, and carries a natural-abundance value (P2374) exactly when it
 * occurs in nature. That P2374 filter is the whole point — it narrows the ~30
 * isotopes an element has down to the naturally-occurring handful (iron →
 * Fe-54/56/57/58), and it excludes nuclear isomers, which have no abundance.
 *
 * The earlier `wdt:P31 wd:Q25276` filter was wrong and returned nothing:
 * isotopes are `instance of` a per-element class ("isotope of iron"), never the
 * generic Q25276.
 *
 * GROUP_CONCAT aggregates per element; without it the result would be one row
 * per isotope and the caller's dedup would silently keep just one.
 */
const SPARQL_QUERY = `
SELECT ?symbol ?atomicNumber
       (GROUP_CONCAT(DISTINCT ?isotopeLabel; separator="${CONCAT_SEPARATOR}") AS ?isotopes)
WHERE {
  ?element wdt:P31 wd:Q11344 ;
           wdt:P1086 ?atomicNumber ;
           wdt:P246 ?symbol .
  FILTER(?atomicNumber >= 1 && ?atomicNumber <= ${ELEMENT_COUNT})

  ?isotope wdt:P279 ?element ;
           wdt:P2374 ?abundance .

  ?isotope rdfs:label ?isotopeLabel .
  FILTER(LANG(?isotopeLabel) = "en")
}
GROUP BY ?symbol ?atomicNumber
ORDER BY ?atomicNumber
`;

/** Iron (atomic number 26) is the reference element the probe explores. */
const PROBE_ATOMIC_NUMBER = 26;

/**
 * DISCOVERY A — items linking TO iron whose English label looks like an isotope
 * ("iron-<n>"). Anchors on the element by atomic number (a pattern the main
 * fetch already proves works), so it needs no hardcoded QID and no exact-label
 * match. For each, it reports the linking property and the instance-of class —
 * the two unknowns the seeding query guessed at.
 */
const PROBE_INBOUND_QUERY = `
SELECT DISTINCT ?isotope ?isotopeLabel ?linkPropLabel ?classLabel
WHERE {
  ?element wdt:P31 wd:Q11344 ; wdt:P1086 ?z .
  FILTER(?z = ${PROBE_ATOMIC_NUMBER})
  ?isotope ?directLink ?element .
  ?linkProp wikibase:directClaim ?directLink .
  OPTIONAL { ?isotope wdt:P31 ?class . }
  ?isotope rdfs:label ?isotopeLabel .
  FILTER(LANG(?isotopeLabel) = "en" && STRSTARTS(LCASE(STR(?isotopeLabel)), "iron-"))
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?isotopeLabel
LIMIT 40
`;

/**
 * DISCOVERY B — every direct claim on one iron isotope, found case-insensitively
 * by label. Reveals which property carries the natural-abundance value (the
 * seeding query assumed P2374) and how the isotope references its element.
 */
const PROBE_DUMP_QUERY = `
SELECT ?propLabel ?value ?valueLabel
WHERE {
  ?isotope rdfs:label ?il .
  FILTER(LANG(?il) = "en" && LCASE(STR(?il)) = "iron-56")
  ?isotope ?directClaim ?value .
  ?prop wikibase:directClaim ?directClaim .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?propLabel
`;

interface SparqlBinding {
  [key: string]: { value: string } | undefined;
}

const QUERY_MAX_ATTEMPTS = 4;
const QUERY_RETRY_BASE_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a SPARQL query and return its bindings, retrying on transient failures.
 * SPARQL over a heavy public endpoint occasionally drops a connection ("fetch
 * failed") or rate-limits; a couple of backed-off retries make the probe and
 * the seeding run reliable rather than aborting on the first blip.
 */
async function runQuery(query: string): Promise<SparqlBinding[]> {
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`;

  for (let attempt = 0; attempt < QUERY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = (await response.json()) as { results: { bindings: SparqlBinding[] } };
      return payload.results.bindings;
    } catch (error) {
      if (attempt === QUERY_MAX_ATTEMPTS - 1) {
        throw new Error(
          `Wikidata SPARQL query failed after ${QUERY_MAX_ATTEMPTS} attempts: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await sleep(QUERY_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  return []; // unreachable; the loop either returns or throws
}

/** The QID tail of a Wikidata entity URI, for readability. */
function qid(uri: string | undefined): string {
  return uri?.split('/').pop() ?? '?';
}

/** Discovery mode: print how Wikidata actually models iron's isotopes. */
async function probe(): Promise<void> {
  const inbound = await runQuery(PROBE_INBOUND_QUERY);
  console.log(`[isotopes] DISCOVERY A — items linking to iron, labelled "iron-*": ${inbound.length}\n`);
  if (inbound.length === 0) {
    console.log('  (none — isotopes may not link directly to the element; see B)\n');
  }
  for (const b of inbound) {
    const label = b.isotopeLabel?.value ?? '?';
    const item = qid(b.isotope?.value);
    const linkProp = b.linkPropLabel?.value ?? '?';
    const cls = b.classLabel?.value ?? '(no P31)';
    console.log(`  ${label} [${item}]  --${linkProp}-->  iron   | instance of: ${cls}`);
  }

  const dump = await runQuery(PROBE_DUMP_QUERY);
  console.log(`\n[isotopes] DISCOVERY B — all direct claims on "iron-56": ${dump.length}\n`);
  if (dump.length === 0) {
    console.log('  (no item labelled "iron-56" in English — report this)\n');
  }
  for (const b of dump) {
    const property = b.propLabel?.value ?? '?';
    const value = b.valueLabel?.value ?? b.value?.value ?? '?';
    console.log(`  ${property}: ${value}`);
  }

  console.log(
    '\n[isotopes] From A: the arrow shows the isotope->element PROPERTY, and ' +
      '"instance of" shows the CLASS. From B: find the natural-abundance property ' +
      '(the seeding query assumed P2374). Report both sections and the seeding ' +
      'query gets corrected to match reality.',
  );
}

/** Turn "iron-56" into "Fe-56"; returns null when the label has no mass number. */
export function toIsotopeId(symbol: string, label: string): string | null {
  const match = MASS_NUMBER_PATTERN.exec(label.trim());
  return match?.[1] ? `${symbol}-${match[1]}` : null;
}

async function main(): Promise<void> {
  if (process.argv.slice(2).includes('--probe')) {
    await probe();
    return;
  }

  const bindings = await runQuery(SPARQL_QUERY);

  const isotopesBySymbol: Record<string, string[]> = {};
  const unparsed: string[] = [];

  for (const binding of bindings) {
    const symbol = binding.symbol?.value;
    const labels = binding.isotopes?.value;
    if (!symbol || !labels) continue;

    const ids: string[] = [];
    for (const label of labels.split(CONCAT_SEPARATOR)) {
      const id = toIsotopeId(symbol, label);
      if (id) {
        ids.push(id);
      } else if (label.trim()) {
        unparsed.push(`${symbol}: "${label}"`);
      }
    }

    if (ids.length > 0) {
      // Sort by mass number so the committed file has a stable, readable order.
      isotopesBySymbol[symbol] = [...new Set(ids)].sort(
        (a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]),
      );
    }
  }

  const elementsWithIsotopes = Object.keys(isotopesBySymbol).length;
  const totalIsotopes = Object.values(isotopesBySymbol).reduce(
    (sum, list) => sum + list.length,
    0,
  );

  // Diagnostic first, so a wrong query shape is obvious rather than silently
  // producing an empty file that later looks like "Wikidata has no data".
  console.log(`[isotopes] SPARQL returned ${bindings.length} row(s).`);
  console.log(
    `[isotopes] ${elementsWithIsotopes} element(s) with isotopes, ${totalIsotopes} isotope(s) total.`,
  );

  if (elementsWithIsotopes === 0) {
    throw new Error(
      'No isotopes resolved. This almost certainly means the isotope→element ' +
        'linking pattern in the query is wrong, not that the data is missing. ' +
        'Nothing was written — report this output so the query can be corrected.',
    );
  }

  if (unparsed.length > 0) {
    console.log(`\n[isotopes] ${unparsed.length} label(s) without a mass number, skipped:`);
    for (const entry of unparsed.slice(0, 20)) {
      console.log(`  - ${entry}`);
    }
  }

  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(isotopesBySymbol, null, 2)}\n`,
    'utf8',
  );
  console.log(`\n[isotopes] wrote data/curated/isotopes.json`);
  console.log('[isotopes] REVIEW IT BY HAND before committing — it is curated data from here on.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error('[isotopes] FAILED:', error instanceof Error ? error.message : error);
    // Setting the code rather than calling process.exit() lets Node tear the
    // fetch handles down cleanly — exit() mid-teardown trips a libuv assertion
    // on Windows, which looked alarming but was only exit noise.
    process.exitCode = 1;
  });
}
