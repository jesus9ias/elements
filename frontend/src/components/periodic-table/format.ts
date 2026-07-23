/**
 * Value formatting for element cells and the detail view. Kept together so the
 * unknown-value dash and unit symbols stay consistent across the mode.
 */

/** Dash shown for a value that is genuinely absent (mirrors the i18n key). */
export const UNKNOWN_DASH = '—';

const CELSIUS = '°C';
const KELVIN = 'K';

/** Atomic mass, trimmed of trailing zeros; dash when unknown. */
export function formatMass(mass: number | null): string {
  if (mass === null) return UNKNOWN_DASH;
  return String(Number(mass.toFixed(3)));
}

/** "1538 °C · 1811 K" from a Celsius/Kelvin pair; dash when both absent. */
export function formatTemperature(
  celsius: number | null,
  kelvin: number | null,
): string {
  const parts: string[] = [];
  if (celsius !== null) parts.push(`${Math.round(celsius)} ${CELSIUS}`);
  if (kelvin !== null) parts.push(`${Math.round(kelvin)} ${KELVIN}`);
  return parts.length > 0 ? parts.join(' · ') : UNKNOWN_DASH;
}

/** Join a list into "a, b, c"; dash when empty. */
export function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : UNKNOWN_DASH;
}

/** Electrons per shell as "2 · 8 · 13 · 1"; dash when empty. */
export function formatConfiguration(shells: string[]): string {
  return shells.length > 0 ? shells.join(' · ') : UNKNOWN_DASH;
}

/** A plain text value, or the dash when null/blank. */
export function formatText(value: string | null): string {
  return value && value.trim() !== '' ? value : UNKNOWN_DASH;
}

/**
 * `discoveryDate` is a signed year (BCE stored negative, per `merge.ts`).
 * A BCE year needs era text, which is language-dependent, so the caller
 * supplies `formatBce` from the i18n layer instead of it being hardcoded here.
 */
export function formatDiscoveryYear(
  value: string | null,
  formatBce: (year: number) => string,
): string {
  if (!value) return UNKNOWN_DASH;
  const year = Number(value);
  if (!Number.isFinite(year)) return UNKNOWN_DASH;
  return year < 0 ? formatBce(-year) : String(year);
}
