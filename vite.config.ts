import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import process from "node:process";
import type { Connect, Plugin } from "vite";

/**
 * Shareable links put a document URL in the path (/github.com/o/r/blob/main/a.md),
 * so every browser navigation that isn't an app file must get index.html — even ".md" paths.
 */
function shareLinkFallback(): Plugin {
  const own = /^\/(src|@|node_modules|assets|icons|samples|sw\.js|workbox-|manifest|registerSW|icon\.svg|favicon)/;
  const mw: Connect.NextHandleFunction = (req, _res, next) => {
    const url = req.url ?? "/";
    if (req.headers["sec-fetch-mode"] === "navigate" && url !== "/" && !own.test(url)) req.url = "/index.html";
    next();
  };
  return {
    name: "qari-share-link-fallback",
    configureServer: (server) => void server.middlewares.use(mw),
    configurePreviewServer: (server) => void server.middlewares.use(mw),
  };
}

const host = process.env.TAURI_DEV_HOST;
// Set by the Tauri CLI for beforeDevCommand / beforeBuildCommand.
const isTauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
    shareLinkFallback(),
    VitePWA({
      disable: isTauri,
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icon.svg", "icons/*.png"],
      manifest: {
        id: "/",
        name: "قارئ — Qari",
        short_name: "قارئ",
        description: "قارئ ماركداون هادئ، عربي أولاً — A calm, Arabic-first Markdown reader.",
        lang: "ar",
        dir: "rtl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        background_color: "#f2f2f5",
        theme_color: "#f2f2f5",
        categories: ["productivity", "utilities"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        file_handlers: [
          {
            action: "/",
            accept: { "text/markdown": [".md", ".markdown", ".mdown", ".mkd"] },
          },
        ],
        launch_handler: { client_mode: "focus-existing" },
      } as Record<string, unknown>,
      workbox: {
        // App shell + fonts up front; Shiki grammars, KaTeX and Mermaid are cached the first time a document needs them.
        globPatterns: ["index.html", "*.{svg,png}", "icons/*.png", "assets/index-*.{js,css}", "assets/*.woff2"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: { cacheName: "qari-assets", expiration: { maxEntries: 600 } },
          },
        ],
      },
    }),
  ],
  build: {
    target: isTauri ? (process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15") : "es2022",
    chunkSizeWarningLimit: 1500,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
