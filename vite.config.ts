import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Replaces <!--@include name--> with src/partials/name.html so the
 *  header and footer live in one place across all pages. */
function partials(): Plugin {
  return {
    name: 'html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(/<!--@include\s+([\w-]+)-->/g, (_, name) =>
          readFileSync(resolve(__dirname, 'src/partials', `${name}.html`), 'utf8')),
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), partials()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        pricing: resolve(__dirname, 'pricing.html'),
        demo: resolve(__dirname, 'demo.html'),
      },
    },
  },
})
