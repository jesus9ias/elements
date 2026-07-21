/**
 * Element data model constants shared by the content pipeline and the UI.
 */

/** Total elements covered by the app. */
export const ELEMENT_COUNT = 118;

/**
 * Fields that must be present after merge. A missing one flags the element
 * with `needsReview: true` instead of shipping a silent gap.
 *
 * Deliberately excludes fields that are legitimately absent for many elements
 * (`halfLife` for stable elements, `knownIsotopes` when Wikidata has no claim,
 * melting/boiling points for some synthetics).
 */
export const REQUIRED_ELEMENT_FIELDS = [
  'atomicNumber',
  'symbol',
  'name',
  'group',
  'atomicMass',
  'discoveryDate',
  'discoverer',
  'electronConfiguration',
  'description',
  'uses',
  'characteristics',
  'sources',
] as const;

export type RequiredElementField = (typeof REQUIRED_ELEMENT_FIELDS)[number];

/** A source attribution entry (doubles as the "learn more" link). */
export interface ElementSource {
  label: string;
  url: string;
}

/** An element record as consumed by the app, per language. */
export interface ElementRecord {
  atomicNumber: number;
  symbol: string;
  name: string;
  group: string;
  atomicMass: number | null;
  meltingPointC: number | null;
  meltingPointK: number | null;
  boilingPointC: number | null;
  boilingPointK: number | null;
  discoveryDate: string | null;
  discoverer: string | null;
  halfLife: string | null;
  knownIsotopes: string[];
  /** Electrons per shell, sourced from the Wikidata claim (never derived). */
  electronConfiguration: string[];
  description: string | null;
  uses: string | null;
  characteristics: string | null;
  sources: ElementSource[];
  needsReview: boolean;
}
