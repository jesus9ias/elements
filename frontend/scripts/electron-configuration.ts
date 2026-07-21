/**
 * Converts Wikidata's electron-configuration claim (P8000) into the
 * electrons-per-shell array the app renders in the Bohr model.
 *
 * Wikidata stores spectroscopic notation with a noble-gas core, e.g. Chromium:
 *   "[Ar] 3d⁵ 4s¹"
 * The app needs electrons per principal shell:
 *   ["2", "8", "13", "1"]
 *
 * This is a faithful, deterministic expansion of the real claim — it preserves
 * genuine exceptions (Cr, Cu, ...) precisely because it never applies a
 * simplified 2n²/Aufbau rule. See `T-ELEM-01`.
 */

/** Unicode superscript digits used by Wikidata → ASCII. */
const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

/** Fully expanded orbital lists for each noble-gas core. */
const NOBLE_GAS_CORES: Record<string, string> = {
  He: '1s2',
  Ne: '1s2 2s2 2p6',
  Ar: '1s2 2s2 2p6 3s2 3p6',
  Kr: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6',
  Xe: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6',
  Rn: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6 4f14 5d10 6s2 6p6',
  Og: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6 4f14 5d10 6s2 6p6 5f14 6d10 7s2 7p6',
};

/** Replace unicode superscripts with plain digits. */
function normalizeSuperscripts(notation: string): string {
  return notation.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (char) => SUPERSCRIPTS[char] ?? char);
}

/** Expand a leading "[Xe]"-style core into its explicit orbitals. */
function expandNobleGasCore(notation: string): string {
  return notation.replace(/\[([A-Z][a-z]?)\]/g, (_match, symbol: string) => {
    const core = NOBLE_GAS_CORES[symbol];
    if (!core) {
      throw new Error(`Unknown noble-gas core "[${symbol}]" in configuration.`);
    }
    return core;
  });
}

/**
 * Parse a Wikidata electron-configuration claim into electrons per shell.
 * Returns `[]` when the claim is absent, so callers can flag `needsReview`.
 */
export function electronsPerShell(notation: string | null | undefined): string[] {
  if (!notation || notation.trim() === '') return [];

  const expanded = expandNobleGasCore(normalizeSuperscripts(notation));

  // Each orbital token looks like "3d5": principal shell, subshell, electrons.
  const tokens = expanded.match(/(\d+)([spdfg])(\d+)/g);
  if (!tokens || tokens.length === 0) {
    throw new Error(`Could not parse electron configuration: "${notation}".`);
  }

  const perShell = new Map<number, number>();
  for (const token of tokens) {
    const parsed = /(\d+)([spdfg])(\d+)/.exec(token);
    if (!parsed) continue;
    const shell = Number(parsed[1]);
    const electrons = Number(parsed[3]);
    perShell.set(shell, (perShell.get(shell) ?? 0) + electrons);
  }

  const highestShell = Math.max(...perShell.keys());
  const result: string[] = [];
  for (let shell = 1; shell <= highestShell; shell += 1) {
    const electrons = perShell.get(shell) ?? 0;
    result.push(String(electrons));
  }
  return result;
}
