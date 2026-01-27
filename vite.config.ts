import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

const browser = process.env.BROWSER || "chrome";

export default defineConfig({
  plugins: [
    react(),

    viteStaticCopy({
      targets: [
        {
          src: `manifest.${browser}.json`,
          dest: ".",
          rename: "manifest.json"
        },
        { src: "public", dest: "." },
        {
          src: "node_modules/webextension-polyfill/dist/browser-polyfill.js",
          dest: "."
        }
      ]
    })
  ],

  build: {
    outDir: browser === "firefox" ? "dist-firefox" : "dist-chrome",
    emptyOutDir: true,

    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        background: resolve(__dirname, `src/background/background.${browser}.ts`),
        content: resolve(__dirname, "src/content-scripts/content-script.ts")
      },
      output: {
        entryFileNames: chunk => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "content") return "content-script.js";
          return "assets/[name]-[hash].js";
        }
      }
    }
  }
});
