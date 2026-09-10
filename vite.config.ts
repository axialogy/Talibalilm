import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

/**
 * Inline the built CSS into the HTML <head> and drop the <link>, so the
 * stylesheet stops being a render-blocking network request. Single-page entry,
 * so no cross-page cache benefit is lost.
 */
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      let out = html;
      for (const [fileName, asset] of Object.entries(ctx.bundle)) {
        if (!fileName.endsWith('.css') || asset.type !== 'asset') continue;
        const css = String(asset.source);
        const base = fileName.split('/').pop()!;
        const linkRe = new RegExp(`<link[^>]+href="[^"]*${base}"[^>]*>`);
        if (linkRe.test(out)) {
          out = out.replace(linkRe, `<style>${css}</style>`);
          delete ctx.bundle[fileName];
        }
      }
      return out;
    },
  };
}

export default defineConfig({
  plugins: [TanStackRouterVite({ autoCodeSplitting: true }), react(), inlineCss()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', '@tanstack/react-router'],
        },
      },
    },
  },
});
