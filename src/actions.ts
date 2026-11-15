import { useApp } from "./state/app";
import { useSettings } from "./state/settings";
import { platform } from "./platform";
import type { Workspace, RecentItem } from "./platform/types";
import { translate } from "./i18n";

async function guard(task: () => Promise<Workspace | null>) {
  try {
    const ws = await task();
    if (ws) await useApp.getState().openWorkspace(ws);
    return ws;
  } catch {
    const lang = useSettings.getState().lang;
    useApp.getState().notify(translate(lang, "errorRead"));
    return null;
  }
}

export const openFile = () => guard(() => platform().pickFile());
export const openFolder = () => guard(() => platform().pickFolder());

/** Open a GitHub repo/folder/file or any https Markdown URL. Returns an error key on failure. */
export async function openUrl(input: string, hash?: string): Promise<"errorUrl" | "errorUrlFetch" | null> {
  const { workspaceFromUrl, normaliseUrl } = await import("./platform/remote");
  if (!normaliseUrl(input)) return "errorUrl";
  try {
    const { ws, initial } = await workspaceFromUrl(input);
    await useApp.getState().openWorkspace(ws, initial, hash);
    return null;
  } catch {
    return "errorUrlFetch";
  }
}

export async function openRecent(item: RecentItem) {
  if (item.url) {
    const err = await openUrl(item.url);
    if (err) useApp.getState().notify(translate(useSettings.getState().lang, err));
    return;
  }
  const ws = await guard(() => platform().openRecent(item));
  if (!ws) {
    const lang = useSettings.getState().lang;
    useApp.getState().notify(translate(lang, platform().isTauri ? "errorRead" : "errorPermission"));
  }
}

export async function openPaths(paths: string[]) {
  if (!paths.length) return;
  const { workspaceFromPath } = await import("./platform/tauri");
  await guard(() => workspaceFromPath(paths[0]));
}

export function toggleLang() {
  const s = useSettings.getState();
  s.set("lang", s.lang === "ar" ? "en" : "ar");
}

export type ActionId =
  | "open_file"
  | "open_folder"
  | "open_url"
  | "quick_open"
  | "settings"
  | "zoom_in"
  | "zoom_out"
  | "zoom_reset"
  | "focus"
  | "find"
  | "outline"
  | "prev"
  | "next"
  | "toggle_lang";

export function run(id: ActionId | string) {
  const app = useApp.getState();
  const settings = useSettings.getState();
  switch (id) {
    case "open_file":
      return void openFile();
    case "open_folder":
      return void openFolder();
    case "open_url":
      app.set({ focus: false, chromeHidden: false });
      return app.togglePanel("url");
    case "quick_open":
      if (app.ws && app.ws.entries.length > 1) app.togglePanel("quick");
      return;
    case "settings":
      return app.togglePanel("settings");
    case "zoom_in":
      return settings.bumpFont(1);
    case "zoom_out":
      return settings.bumpFont(-1);
    case "zoom_reset":
      return settings.resetFont();
    case "focus":
      return app.set({ focus: !app.focus, panel: null });
    case "find":
      if (app.doc) app.set({ find: true, panel: null, focus: false });
      return;
    case "outline": {
      if (!app.doc) return;
      const trigger = document.querySelector("[data-trigger='outline']");
      app.set({ focus: false, chromeHidden: false });
      return app.togglePanel("outline", trigger);
    }
    case "prev":
      return app.step(-1);
    case "next":
      return app.step(1);
    case "toggle_lang":
      return toggleLang();
  }
}
