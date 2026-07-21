import { getViteConfig } from 'astro/config';

// Uses Astro's own Vite config so tests resolve modules exactly like the app.
// `passWithNoTests` keeps Stage 1 green: the T-* suites are authored in Stage 2.
export default getViteConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.{ts,tsx}'],
  },
});
