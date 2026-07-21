/**
 * Application routes and mode identifiers. URLs are in English, no language
 * prefix (monorepo decision).
 */

/** The two primary modes of the platform. */
export const APP_MODES = {
  PERIODIC_TABLE: 'periodic-table',
  MOLECULES: 'molecules',
} as const;

export type AppMode = (typeof APP_MODES)[keyof typeof APP_MODES];

/** Route path per mode. Periodic table is the home route. */
export const ROUTES: Record<AppMode, string> = {
  [APP_MODES.PERIODIC_TABLE]: '/',
  [APP_MODES.MOLECULES]: '/molecules',
};
