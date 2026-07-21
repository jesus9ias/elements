/**
 * probe-configuration.ts — read-only diagnostic for the missing P8000 electron
 * configurations.
 *
 * Local developer tool. Run BY THE DEVELOPER (see the monorepo spec's
 * "No external calls without direct authorization" rule).
 *
 * After a full run, 54 elements still have an empty `electronConfiguration`.
 * The main fetch uses the truthy prefix `wdt:P8000`, which returns only the
 * best-ranked statement. This probe queries the FULL statement path
 * `p:P8000/ps:P8000` (every statement, any rank) for a sample of the failing
 * elements plus one that works, printing each value and its rank.
 *
 * It answers one question: do these elements HAVE a P8000 claim that the
 * truthy prefix is skipping (a rank problem, fixable in the query), or is the
 * claim simply absent on Wikidata (needs a curated fallback)?
 *
 * Usage:
 *   node --experimental-strip-types scripts/probe-configuration.ts
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ELEMENT_COUNT } from '../src/constants/elements.ts';

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'ElementsEducationalApp/0.1 (local content pipeline)';

/** As(33), Au(79), U(92) fail; Cr(24) works — a control to compare against. */
const SAMPLE_ATOMIC_NUMBERS = [33, 79, 92, 24];

// Match atomic numbers with FILTER IN, not VALUES. Wikidata stores P1086 as a
// typed decimal ("33"^^xsd:decimal); VALUES does exact term matching, so integer
// literals match nothing, whereas FILTER numeric comparison coerces the types.
const PROBE_QUERY = `
SELECT ?atomicNumber ?symbol ?config ?configType ?rank
WHERE {
  ?item wdt:P31 wd:Q11344 ;
        wdt:P1086 ?atomicNumber ;
        wdt:P246 ?symbol .
  FILTER(?atomicNumber IN (${SAMPLE_ATOMIC_NUMBERS.join(', ')}))
  OPTIONAL {
    ?item p:P8000 ?statement .
    ?statement ps:P8000 ?config .
    ?statement wikibase:rank ?rank .
    BIND(DATATYPE(?config) AS ?configType)
  }
}
ORDER BY ?atomicNumber
`;

/**
 * Categorizes all 118 at once: how many carry P8000 via the truthy prefix
 * (`wdt:`, best-ranked only) vs via the full statement path (`p:/ps:`, any
 * rank). If the two counts differ, the gap is a rank problem; if they match at
 * 64, the missing 54 genuinely lack the claim.
 */
const COUNT_QUERY = `
SELECT
  (COUNT(DISTINCT ?truthy) AS ?truthyCount)
  (COUNT(DISTINCT ?anyRank) AS ?anyRankCount)
WHERE {
  ?item wdt:P31 wd:Q11344 ; wdt:P1086 ?z .
  FILTER(?z >= 1 && ?z <= ${ELEMENT_COUNT})
  OPTIONAL { ?item wdt:P8000 ?tc . BIND(?item AS ?truthy) }
  OPTIONAL { ?item p:P8000/ps:P8000 ?ac . BIND(?item AS ?anyRank) }
}
`;

interface SparqlBinding {
  [key: string]: { value: string; type?: string } | undefined;
}

async function runQuery(query: string): Promise<SparqlBinding[]> {
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Wikidata SPARQL query failed: HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { results: { bindings: SparqlBinding[] } };
  return payload.results.bindings;
}

async function main(): Promise<void> {
  const counts = (await runQuery(COUNT_QUERY))[0];
  const truthy = counts?.truthyCount?.value ?? '?';
  const anyRank = counts?.anyRankCount?.value ?? '?';
  console.log(
    `[probe] across all ${ELEMENT_COUNT} elements: P8000 via wdt: (truthy) = ${truthy}, ` +
      `via p:/ps: (any rank) = ${anyRank}`,
  );
  console.log(
    `[probe] if any-rank > truthy, the missing ones are a RANK problem; ` +
      `if both equal, the claim is genuinely absent for the rest.\n`,
  );

  const bindings = await runQuery(PROBE_QUERY);
  console.log(`[probe] ${bindings.length} sample row(s) for elements ${SAMPLE_ATOMIC_NUMBERS.join(', ')}:\n`);

  for (const binding of bindings) {
    const z = binding.atomicNumber?.value ?? '?';
    const symbol = binding.symbol?.value ?? '?';
    const config = binding.config?.value;
    const rank = binding.rank?.value.split('#').pop() ?? '';
    const valueType = binding.config?.type ?? '';

    if (!config) {
      console.log(`  ${symbol} (${z}): NO P8000 statement at all`);
    } else {
      // A `uri` value type means the claim points at an item (QID), not a
      // spectroscopic string — that would explain why the string parser gets
      // nothing usable.
      console.log(`  ${symbol} (${z}): rank=${rank} type=${valueType} value=${JSON.stringify(config)}`);
    }
  }

  console.log(
    '\n[probe] Read the sample rows:\n' +
      '  - If As/Au/U show a statement with rank=normal while Cr shows rank=preferred,\n' +
      "    it's a RANK problem — switch the query from wdt:P8000 to p:P8000/ps:P8000.\n" +
      '  - If As/Au/U show "NO P8000 statement", the claim is genuinely ABSENT and\n' +
      '    those elements need a curated fallback source.\n' +
      '  - If value type is "uri", P8000 points at an item, not a string, and the\n' +
      '    parser needs to resolve the label instead.\n' +
      'Report these rows and the fix follows from them.',
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error('[probe] FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
