/**
 * Element category (`group`) data — which category each of the 118 elements
 * belongs to.
 *
 * This is pipeline INPUT: `merge.ts` needs it to fill the required `group`
 * field, since Wikidata's own category modelling is too inconsistent to query
 * reliably. Category membership is fixed, well-established reference data, so a
 * constants file is the right home for it.
 *
 * Stage 5 adds `categoryColor()` and the CSS color tokens on top of this data
 * (`T-ELEM-02`). Nothing presentational belongs here yet.
 */

export const ELEMENT_CATEGORIES = [
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'metalloid',
  'nonmetal',
  'halogen',
  'noble-gas',
  'lanthanide',
  'actinide',
] as const;

export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

/** Inclusive range helper, so contiguous blocks stay readable. */
function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

/**
 * Atomic numbers per category. Listed by category rather than as a flat
 * 118-entry map so each group can be reviewed at a glance.
 *
 * Two conventional judgement calls worth knowing about, since sources differ:
 * polonium (84) is treated as a post-transition metal rather than a metalloid,
 * and astatine (85) as a halogen rather than a metalloid.
 */
const ATOMIC_NUMBERS_BY_CATEGORY: Record<ElementCategory, number[]> = {
  'alkali-metal': [3, 11, 19, 37, 55, 87],
  'alkaline-earth-metal': [4, 12, 20, 38, 56, 88],
  'transition-metal': [
    ...range(21, 30),
    ...range(39, 48),
    ...range(72, 80),
    ...range(104, 112),
  ],
  'post-transition-metal': [13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116],
  metalloid: [5, 14, 32, 33, 51, 52],
  nonmetal: [1, 6, 7, 8, 15, 16, 34],
  halogen: [9, 17, 35, 53, 85, 117],
  'noble-gas': [2, 10, 18, 36, 54, 86, 118],
  lanthanide: range(57, 71),
  actinide: range(89, 103),
};

/** Total elements covered, mirrored from `elements.ts` expectations. */
const FIRST_ATOMIC_NUMBER = 1;
const LAST_ATOMIC_NUMBER = 118;

/** Atomic number → category, built once from the lists above. */
const CATEGORY_BY_ATOMIC_NUMBER = new Map<number, ElementCategory>();

for (const [category, atomicNumbers] of Object.entries(ATOMIC_NUMBERS_BY_CATEGORY)) {
  for (const atomicNumber of atomicNumbers) {
    const existing = CATEGORY_BY_ATOMIC_NUMBER.get(atomicNumber);
    if (existing) {
      throw new Error(
        `Element ${atomicNumber} is listed under both "${existing}" and "${category}".`,
      );
    }
    CATEGORY_BY_ATOMIC_NUMBER.set(atomicNumber, category as ElementCategory);
  }
}

// Integrity guard: every element from 1 to 118 must be categorized exactly once.
// A typo in the lists above would otherwise surface as a silent `needsReview`
// halfway through a pipeline run.
const uncategorized: number[] = [];
for (let atomicNumber = FIRST_ATOMIC_NUMBER; atomicNumber <= LAST_ATOMIC_NUMBER; atomicNumber += 1) {
  if (!CATEGORY_BY_ATOMIC_NUMBER.has(atomicNumber)) {
    uncategorized.push(atomicNumber);
  }
}
if (uncategorized.length > 0) {
  throw new Error(`No category defined for element(s): ${uncategorized.join(', ')}.`);
}

/** The category an element belongs to, or null if the number is out of range. */
export function categoryFor(atomicNumber: number): ElementCategory | null {
  return CATEGORY_BY_ATOMIC_NUMBER.get(atomicNumber) ?? null;
}

/** Prefix of the CSS custom property that carries each category's color. */
export const CATEGORY_COLOR_TOKEN_PREFIX = '--category-';

/**
 * The CSS custom-property NAME for a category's color (the value lives in
 * `tokens.css`). Deterministic: the same category always maps to the same
 * token — this is what `T-ELEM-02` pins down. Kept as the variable name rather
 * than a resolved color so the single source of truth stays in CSS.
 */
export function categoryColor(category: ElementCategory): string {
  return `${CATEGORY_COLOR_TOKEN_PREFIX}${category}`;
}
