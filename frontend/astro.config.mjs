// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// English-only URLs, no language prefix (see monorepo spec: URLs are in English).
// i18n is a client-side concern handled by i18next, not by Astro routing.
export default defineConfig({
  server: { port: 4332 },
  integrations: [react()],
  vite: {
    build: {
      // The 3D Bohr model (Stage 5) and molecule viewer (Stage 6) depend on
      // Three.js, an inherently ~520 kB vendor chunk that does not tree-shake
      // down meaningfully. It is already code-split so it loads on demand (only
      // when a detail/viewer opens), never in the initial grid bundle — so the
      // default 500 kB warning is expected for that one lazy chunk. Raised to
      // acknowledge it rather than leave a standing warning that trains us to
      // ignore build output.
      chunkSizeWarningLimit: 600,
      // Vite's default CSS minifier (lightningcss, via the Vite version bundled
      // with @astrojs/react) treats `backdrop-filter` and `-webkit-backdrop-filter`
      // as the same logical property and keeps only whichever is declared last,
      // silently dropping the other. Every glass surface (.element-cell,
      // .glass--bar/panel/raised) declares both, so production builds lost the
      // standard property while dev (unminified) kept it — a real dev/prod
      // rendering difference. esbuild's CSS minifier preserves both declarations.
      cssMinify: 'esbuild',
    },
  },
});
