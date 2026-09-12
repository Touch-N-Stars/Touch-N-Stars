import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT_DIR = process.env.VITE_OUT_DIR || 'dist';
const excludeCelestiaAtlasData = process.env.EXCLUDE_CELESTIA_ATLAS_DATA === 'true';

function celestiaAtlasDataExclude(outDir) {
  return {
    name: 'celestia-atlas-data-exclude',
    apply: 'build',
    async closeBundle() {
      if (!excludeCelestiaAtlasData) return;
      const target = resolve(process.cwd(), outDir, 'celestia-atlas-data');
      await rm(target, { recursive: true, force: true });
      this.info?.('Removed celestia-atlas-data from the native build output');
    },
  };
}

function isKnownDependencyAnnotationWarning(log) {
  if (log?.code !== 'INVALID_ANNOTATION') return false;

  const file = (log.loc?.file || log.id || '').replaceAll('\\', '/');
  return (
    file.includes('/node_modules/@microsoft/signalr/') ||
    file.includes('/node_modules/@daybrush/utils/')
  );
}

function isBuildTimingNotice(log) {
  return log?.code === 'PLUGIN_TIMINGS';
}

export default defineConfig({
  plugins: [tailwindcss(), vue(), celestiaAtlasDataExclude(OUT_DIR)],
  publicDir: 'public',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'vue-i18n': 'vue-i18n/dist/vue-i18n.cjs.js',
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
    open: true,
  },
  build: {
    target: 'esnext',
    // CSS is minified by lightningcss, which strips every vendor prefix it
    // considers unnecessary for the target. Inherited from target: 'esnext'
    // that removed all -webkit-user-select declarations from the bundle, and
    // Safari only supports the unprefixed property from 17.0 — so the iOS
    // long-press selection menu came back on every older device. Pin the CSS
    // target separately from the JS target to keep the prefixes.
    cssTarget: ['chrome87', 'safari15', 'ios15'],
    outDir: OUT_DIR,
    assetsInlineLimit: 0,
    emptyOutDir: true,
    rolldownOptions: {
      onLog(level, log, handler) {
        if (isKnownDependencyAnnotationWarning(log) || isBuildTimingNotice(log)) {
          return;
        }
        handler(level, log);
      },
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'celestia-catalog-supplement',
              test: /node_modules[\/]@acocalypso[\/]celestia-atlas[\/]data[\/](?:stellarium-dso-supplement|abell-pn-catalog)\.json/,
              priority: 54,
            },
            {
              name: 'celestia-star-catalog',
              test: /node_modules[\/]@acocalypso[\/]celestia-atlas[\/]data[\/](?:hyg-star-catalog|sao-star-crossids|wr-star-catalog)\.json/,
              priority: 53,
            },
            {
              name: 'celestia-catalog',
              test: /node_modules[\/]@acocalypso[\/]celestia-atlas[\/]data[\/]openngc-viewer-catalog\.json/,
              priority: 52,
            },
            {
              name: 'celestia-bright-sky',
              test: /node_modules[\/]@acocalypso[\/]celestia-atlas[\/]data[\/](?:bright-sky|western-constellations)\.json/,
              priority: 51,
            },
            {
              name: 'celestia-engine',
              test: /node_modules[\/](?:@acocalypso[\/]celestia-atlas|astronomy-engine)[\/]/,
              priority: 50,
            },
            {
              name: 'vue-vendor',
              test: /node_modules[\\/](vue|@vue|vue-router|pinia|vue-i18n|@unhead)[\\/]/,
              priority: 30,
            },
            {
              name: 'realtime-vendor',
              test: /node_modules[\\/](@microsoft[\\/]signalr|@novnc[\\/]novnc)[\\/]/,
              priority: 25,
            },
            {
              name: 'charts-vendor',
              test: /node_modules[\\/](chart\.js|@kurkle)[\\/]/,
              priority: 20,
            },
            {
              name: 'media-vendor',
              test: /node_modules[\\/](@capacitor|@capacitor-community|@capawesome|@capgo)[\\/]/,
              priority: 15,
            },
            {
              name: 'network-vendor',
              test: /node_modules[\\/](axios)[\\/]/,
              priority: 14,
            },
            {
              name: 'zip-vendor',
              test: /node_modules[\\/](jszip)[\\/]/,
              priority: 13,
            },
            {
              name: 'interaction-vendor',
              test: /node_modules[\\/](@daybrush|vue3-moveable|@scena|@egjs|@cfcs|overlap-area|css-styled|framework-utils|croact|@panzoom[\\/]panzoom|vuedraggable|sortablejs)[\\/]/,
              priority: 12,
            },
            {
              name: 'utility-vendor',
              test: /node_modules[\\/](date-fns|papaparse|lodash|uuid|file-saver)[\\/]/,
              priority: 11,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
