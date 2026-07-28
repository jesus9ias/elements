/**
 * Content-pipeline constants (local tooling only — never bundled into the app).
 */

/**
 * Claude Haiku is the spec's first choice for the summarization step: the job
 * is a one-off batch of extraction-only calls, so cost/speed win over depth.
 * Upgradeable to a larger model if extraction quality falls short.
 */
export const SUMMARIZER_MODEL = 'claude-haiku-4-5';

/** Generous enough for three short prose fields; well under Haiku's ceiling. */
export const SUMMARIZER_MAX_TOKENS = 2048;

/**
 * How much Wikipedia text to send per element. Extracts run long; the opening
 * sections carry the description/uses/characteristics we extract.
 */
export const SUMMARIZER_SOURCE_CHAR_LIMIT = 12000;

/** Fields the summarizer extracts from the raw Wikipedia text. */
export const SUMMARIZED_FIELDS = ['description', 'uses', 'characteristics'] as const;
export type SummarizedField = (typeof SUMMARIZED_FIELDS)[number];

/**
 * Molecules carry only description/uses (no `characteristics` — the molecule
 * data model has no such field; physical properties live in the structure).
 */
export const SUMMARIZED_MOLECULE_FIELDS = ['description', 'uses'] as const;
export type SummarizedMoleculeField = (typeof SUMMARIZED_MOLECULE_FIELDS)[number];

/**
 * Wikipedia extract fetching — one title per request, deliberately.
 *
 * TextExtracts only honors `exlimit` together with `exintro`: when the full
 * article text is requested, it returns exactly ONE extract per call and
 * silently ignores every other title. An earlier attempt to batch 20 titles
 * per request therefore gained exactly one extract per batch. Full text is what
 * the summarizer needs, so requests stay sequential and are paced instead.
 */
/** Retries for a throttled or transient response, with exponential backoff. */
export const WIKIPEDIA_MAX_ATTEMPTS = 4;
export const WIKIPEDIA_RETRY_BASE_DELAY_MS = 1000;
/** Courtesy pause between requests, per Wikimedia's API etiquette. */
export const WIKIPEDIA_REQUEST_DELAY_MS = 300;
/** HTTP statuses worth retrying: rate limiting and transient server errors. */
export const RETRYABLE_HTTP_STATUSES = [429, 500, 502, 503, 504];

/**
 * Rate limiting (429) needs a far longer pause than a transient 5xx; this is
 * the base that doubles per attempt, and is only used when the server did not
 * send a `Retry-After` telling us exactly how long to wait.
 */
export const WIKIPEDIA_RATE_LIMIT_DELAY_MS = 5000;
/** Upper bound so a hostile `Retry-After` cannot stall a local run forever. */
export const WIKIPEDIA_MAX_BACKOFF_MS = 60000;

/**
 * The molecule fetch is only ~40 requests, so it can afford to be gentler than
 * the 118-element run and stay well clear of rate limiting.
 */
export const MOLECULE_REQUEST_DELAY_MS = 1000;

/** Attribution labels and URL shapes written into each element's `sources`. */
export const SOURCE_LABEL_WIKIDATA = 'Wikidata';
export const SOURCE_LABEL_WIKIPEDIA = 'Wikipedia';
export const WIKIDATA_ENTITY_URL_PREFIX = 'https://www.wikidata.org/wiki/';

/**
 * A statement Wikidata marks as "unknown value" (e.g. P61 for elements with
 * no individually credited discoverer) has no real object to label, so the
 * label service resolves it to the blank node's own skolemized IRI under this
 * prefix. That IRI is not data — the merge step treats it as absent, same as
 * any other missing field.
 */
export const WIKIDATA_GENID_PREFIX = 'http://www.wikidata.org/.well-known/genid/';

/**
 * Placeholder a curated override can hold in place of `null`, meaning
 * "checked — genuinely absent" rather than "not yet looked at". Example: Fe,
 * Au, Ag, Cu and Sn's `discoverer` — there is no individual to credit for
 * elements known since prehistoric antiquity.
 *
 * What justifies the marker is the curated reading of the source articles,
 * NOT the shape of the Wikidata statement: of those five, only Fe and Au have
 * an explicit "unknown value" P61; Ag, Cu and Sn have no P61 statement at all,
 * and Sn has no P575 either (its `discoveryDate` carries the marker too). An
 * absent statement on its own means nothing — Wikidata simply may not have
 * been filled in — so it is never sufficient grounds by itself.
 *
 * `merge.ts` excludes a field holding this marker from `needsReview`, then
 * writes real `null` in its place; the marker itself never reaches the
 * shipped config or the UI.
 */
export const CONFIRMED_ABSENT = '$confirmed-absent';

/**
 * Fields carried by `src/config/common.json`, the language-agnostic
 * convenience index. Everything here is identical across languages, so the
 * index never diverges from the per-language files it duplicates.
 *
 * `name`, `discoveryDate`, `discoverer`, the prose fields and `sources` are
 * deliberately absent: all of them vary by language. `discoveryDate` in
 * particular is a language-agnostic signed year in the merged per-language
 * files, but a BCE value renders as era text ("antes de nuestra era" / "BCE")
 * via `periodicTable.discoveryBce`, which differs per language.
 */
export const LANGUAGE_AGNOSTIC_ELEMENT_FIELDS = [
  'atomicNumber',
  'symbol',
  'group',
  'atomicMass',
  'meltingPointC',
  'meltingPointK',
  'boilingPointC',
  'boilingPointK',
  'halfLife',
  'electronConfiguration',
  'knownIsotopes',
] as const;
