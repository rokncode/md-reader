import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/app.css";
import App from "./App";
import { initPlatform } from "./platform";
import { useSettings } from "./state/settings";
import { applyLang } from "./i18n";
import { applyFonts } from "./fonts/registry";

async function boot() {
  // Direction and fonts before first paint — no LTR flash for an Arabic-first app.
  const s = useSettings.getState();
  applyLang(s.lang);
  const dark = s.theme === "dark" || (s.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  await initPlatform();
  await Promise.race([applyFonts(s.fontAr, s.fontEn), new Promise((r) => setTimeout(r, 400))]);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  if (import.meta.env.PROD && !("__TAURI_INTERNALS__" in window)) {
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
  }
}

void boot();
