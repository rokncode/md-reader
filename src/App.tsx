import { useEffect } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { FileDown } from "lucide-react";
import { useApp } from "./state/app";
import { useSettings } from "./state/settings";
import { applyLang, useT, translate } from "./i18n";
import { readRoute, syncAddressBar } from "./lib/share";
import { applyFonts } from "./fonts/registry";
import { platform, isMacLike } from "./platform";
import { run, openPaths, type ActionId } from "./actions";
import { Toolbar } from "./ui/Toolbar";
import { Reader } from "./ui/Reader";
import { Panels } from "./ui/Panels";
import { QuickOpen } from "./ui/QuickOpen";
import { SettingsSheet } from "./ui/SettingsSheet";
import { FindBar } from "./ui/FindBar";
import { UrlSheet } from "./ui/UrlField";
import { openUrl } from "./actions";
import { spring } from "./ui/motion";
import { stripExt } from "./lib/path";

const MEASURE = { narrow: "58ch", normal: "68ch", wide: "84ch" } as const;
const LEADING = { compact: [1.75, 1.55], normal: [1.95, 1.7], relaxed: [2.15, 1.88] } as const;

function useAppearance() {
  const s = useSettings();
  const p = platform();

  useEffect(() => {
    applyLang(s.lang);
    if (p.isTauri && p.kind === "mac") {
      void import("@tauri-apps/api/core").then(({ invoke }) => invoke("set_locale", { locale: s.lang }).catch(() => {}));
    }
  }, [s.lang, p]);

  useEffect(() => {
    void applyFonts(s.fontAr, s.fontEn);
  }, [s.fontAr, s.fontEn]);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--reader-size", `${s.fontSize}px`);
    root.setProperty("--measure", MEASURE[s.measure]);
    root.setProperty("--leading-ar", String(LEADING[s.leading][0]));
    root.setProperty("--leading-en", String(LEADING[s.leading][1]));
  }, [s.fontSize, s.measure, s.leading]);

  // Theme: always resolve to a concrete data-theme so CSS has a single dark block.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = s.theme === "dark" || (s.theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1c1c1e" : "#f2f2f5");
      void applyWindowMaterial(s.glass, dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [s.theme, s.glass]);
}

/** Native window material: Liquid Glass on macOS, Mica on Windows, nothing on the web. */
async function applyWindowMaterial(glass: boolean, dark: boolean) {
  const p = platform();
  const root = document.documentElement;
  if (!p.isTauri || (p.kind !== "mac" && p.kind !== "windows")) {
    root.dataset.glass = "off";
    return;
  }
  root.dataset.glass = glass ? "on" : "off";
  try {
    if (p.kind === "mac") {
      const { setLiquidGlassEffect, GlassMaterialVariant } = await import("tauri-plugin-liquid-glass-api");
      await setLiquidGlassEffect(
        glass ? { enabled: true, variant: GlassMaterialVariant.Regular, tintColor: dark ? "#00000026" : "#ffffff14" } : { enabled: false },
      );
    } else {
      const { getCurrentWindow, Effect } = await import("@tauri-apps/api/window");
      const w = getCurrentWindow();
      if (glass) await w.setEffects({ effects: [Effect.Mica] });
      else await w.clearEffects();
    }
  } catch {
    root.dataset.glass = "off";
  }
}

function useShortcuts() {
  useEffect(() => {
    const p = platform();
    const nativeMenu = p.isTauri && p.kind === "mac";
    const onKey = (e: KeyboardEvent) => {
      const app = useApp.getState();
      if (e.key === "Escape") {
        if (app.panel) app.setPanel(null);
        else if (app.find) app.set({ find: false });
        else if (app.focus) app.set({ focus: false });
        else return;
        e.preventDefault();
        return;
      }
      const mod = isMacLike() ? e.metaKey : e.ctrlKey;
      if (!mod || e.altKey) return;
      if (nativeMenu) return; // the macOS menu bar owns these accelerators
      const k = e.key.toLowerCase();
      const map: Record<string, ActionId> = {
        o: e.shiftKey ? "open_folder" : "open_file",
        p: "quick_open",
        ",": "settings",
        "=": "zoom_in",
        "+": "zoom_in",
        "-": "zoom_out",
        "0": "zoom_reset",
        ".": "focus",
        f: "find",
        "[": "prev",
        "]": "next",
        t: "outline",
        l: e.shiftKey ? "toggle_lang" : "open_url",
      };
      const id = map[k];
      if (!id || (id === "outline" && !e.shiftKey)) return;
      e.preventDefault();
      run(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function useOsIntegration() {
  useEffect(() => {
    const p = platform();
    const cleanups: (() => void)[] = [];
    const set = useApp.getState().set;

    if (p.isTauri) {
      void (async () => {
        const [{ listen }, { invoke }, { getCurrentWebview }] = await Promise.all([
          import("@tauri-apps/api/event"),
          import("@tauri-apps/api/core"),
          import("@tauri-apps/api/webview"),
        ]);
        cleanups.push(await listen<string>("menu", (e) => run(e.payload)));
        cleanups.push(await listen<string[]>("open-paths", (e) => void openPaths(e.payload)));
        cleanups.push(
          await getCurrentWebview().onDragDropEvent((e) => {
            const type = e.payload.type;
            set({ dragging: type === "enter" || type === "over" });
          }),
        );
        const pending = await invoke<string[]>("take_pending_paths").catch(() => []);
        if (pending.length) void openPaths(pending);
      })();
    } else {
      // Shareable links: /github.com/o/r/blob/main/a.md, /https://site/doc.md, /?open=<url>
      const route = readRoute();
      if (route) {
        void openUrl(route.target, route.hash).then((err) => {
          if (err) {
            history.replaceState(null, "", "/");
            useApp.getState().notify(translate(useSettings.getState().lang, err));
          }
        });
      }
      cleanups.push(syncAddressBar());
      void import("./platform/web").then(({ workspaceFromDrop, fileFromHandle }) => {
        let depth = 0;
        const enter = (e: DragEvent) => {
          if (!e.dataTransfer?.types.includes("Files")) return;
          e.preventDefault();
          depth++;
          set({ dragging: true });
        };
        const over = (e: DragEvent) => e.preventDefault();
        const leave = () => {
          depth = Math.max(0, depth - 1);
          if (!depth) set({ dragging: false });
        };
        const drop = async (e: DragEvent) => {
          e.preventDefault();
          depth = 0;
          set({ dragging: false });
          if (!e.dataTransfer) return;
          const ws = await workspaceFromDrop(e.dataTransfer).catch(() => null);
          if (ws) void useApp.getState().openWorkspace(ws);
        };
        window.addEventListener("dragenter", enter);
        window.addEventListener("dragover", over);
        window.addEventListener("dragleave", leave);
        window.addEventListener("drop", drop);
        cleanups.push(() => {
          window.removeEventListener("dragenter", enter);
          window.removeEventListener("dragover", over);
          window.removeEventListener("dragleave", leave);
          window.removeEventListener("drop", drop);
        });
        // Installed PWA: "Open with Qari" from the OS
        window.launchQueue?.setConsumer(({ files }) => {
          if (files?.[0]) void useApp.getState().openWorkspace(fileFromHandle(files[0]));
        });
      });
    }
    return () => cleanups.forEach((c) => c());
  }, []);
}

function useWindowTitle() {
  const doc = useApp((s) => s.doc);
  const t = useT();
  useEffect(() => {
    const title = doc ? stripExt(doc.name) : t("appName");
    document.title = title;
    if (platform().isTauri) {
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().setTitle(title).catch(() => {}));
    }
  }, [doc, t]);
}

function DropOverlay() {
  const t = useT();
  return (
    <motion.div
      className="fixed z-[80] grid place-items-center pointer-events-none"
      style={{
        inset: 10,
        borderRadius: "var(--r-xl)",
        background: "color-mix(in srgb, var(--accent) 10%, transparent)",
        boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--accent) 55%, transparent)",
        backdropFilter: "blur(6px)",
      }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring}
    >
      <div className="glass-thick flex items-center gap-2" style={{ padding: "14px 22px", borderRadius: 999, fontWeight: 700, fontSize: 15 }}>
        <FileDown size={18} style={{ color: "var(--accent)" }} />
        {t("dropHere")}
      </div>
    </motion.div>
  );
}

function FocusHint() {
  const t = useT();
  return (
    <motion.div
      className="toast glass"
      style={{ top: 14, bottom: "auto", fontWeight: 500, color: "var(--text-2)" }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: [0, 1, 1, 0], y: 0 }}
      transition={{ duration: 2.4, times: [0, 0.1, 0.8, 1] }}
    >
      {t("exitFocus")}
    </motion.div>
  );
}

export default function App() {
  useAppearance();
  useShortcuts();
  useOsIntegration();
  useWindowTitle();
  const panel = useApp((s) => s.panel);
  const find = useApp((s) => s.find);
  const dragging = useApp((s) => s.dragging);
  const toast = useApp((s) => s.toast);
  const focus = useApp((s) => s.focus);
  const ws = useApp((s) => s.ws);
  const loading = useApp((s) => s.loading);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <Reader />
        <div className="progress" data-active={loading || undefined} aria-hidden />
        <Toolbar />
        <Panels />
        <AnimatePresence>
          {panel === "quick" && ws ? <QuickOpen key="quick" /> : null}
          {panel === "settings" ? <SettingsSheet key="settings" /> : null}
          {panel === "url" ? <UrlSheet key="url" /> : null}
          {find ? <FindBar key="find" /> : null}
          {dragging ? <DropOverlay key="drop" /> : null}
          {focus ? <FocusHint key="focus" /> : null}
          {toast ? (
            <motion.div
              key="toast"
              className="toast glass-thick"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={spring}
            >
              {toast}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
