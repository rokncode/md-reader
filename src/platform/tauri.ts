import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { sep } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readTextFile, stat, watch, exists } from "@tauri-apps/plugin-fs";
import { openUrl, openPath } from "@tauri-apps/plugin-opener";
import { platform as osPlatform } from "@tauri-apps/plugin-os";
import type { Entry, Platform, PlatformKind, RecentItem, Workspace } from "./types";
import { basename, isMarkdown, sortEntries, SKIP_DIRS, MAX_FILES, MD_EXT } from "../lib/path";
import { loadRecents, pushRecent, clearRecents } from "./recents";

const SEP = sep();

function join(root: string, rel: string) {
  if (!rel) return root;
  const native = SEP === "\\" ? rel.replace(/\//g, "\\") : rel;
  const r = root.endsWith(SEP) ? root.slice(0, -1) : root;
  return `${r}${SEP}${native}`;
}

/** Normalise an absolute path containing ../ segments (desktop single files may link to siblings above). */
function normalizeAbs(p: string) {
  const isWin = SEP === "\\";
  const parts = p.split(/[\\/]/);
  const out: string[] = [];
  for (const seg of parts) {
    if (seg === "..") {
      if (out.length > 1) out.pop();
    } else if (seg !== ".") out.push(seg);
  }
  const joined = out.join(isWin ? "\\" : "/");
  return isWin ? joined : joined.startsWith("/") ? joined : `/${joined}`;
}

function parentOf(p: string) {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i <= 0 ? p.slice(0, i + 1) || p : p.slice(0, i);
}

async function walk(root: string): Promise<Entry[]> {
  const out: Entry[] = [];
  async function visit(dirRel: string, depth: number) {
    if (depth > 10 || out.length >= MAX_FILES) return;
    let items;
    try {
      items = await readDir(join(root, dirRel));
    } catch {
      return;
    }
    const subdirs: string[] = [];
    for (const it of items) {
      if (it.name.startsWith(".")) continue;
      const rel = dirRel ? `${dirRel}/${it.name}` : it.name;
      if (it.isDirectory) {
        if (!SKIP_DIRS.has(it.name)) subdirs.push(rel);
      } else if (isMarkdown(it.name)) {
        out.push({ rel, name: it.name, dir: dirRel });
      }
    }
    await Promise.all(subdirs.map((d) => visit(d, depth + 1)));
  }
  await visit("", 0);
  return sortEntries(out);
}

function makeWorkspace(kind: "file" | "folder", root: string, entries: Entry[], recent: RecentItem): Workspace {
  const stops = new Set<() => void>();
  return {
    kind,
    name: recent.name,
    entries,
    recent,
    async read(rel) {
      const abs = join(root, rel);
      const [text, info] = await Promise.all([readTextFile(abs), stat(abs).catch(() => null)]);
      return { text, mtime: info?.mtime ? new Date(info.mtime).getTime() : Date.now() };
    },
    async assetUrl(rel) {
      return convertFileSrc(normalizeAbs(join(root, rel)));
    },
    watch(rel, onChange) {
      let stop: (() => void) | null = null;
      let cancelled = false;
      watch(join(root, rel), () => onChange(), { delayMs: 200 })
        .then((un) => {
          if (cancelled) un();
          else stop = un;
        })
        .catch(() => {});
      const s = () => {
        cancelled = true;
        stop?.();
        stops.delete(s);
      };
      stops.add(s);
      return s;
    },
    async openLocal(rel) {
      await openPath(normalizeAbs(join(root, rel)));
    },
    dispose() {
      for (const s of [...stops]) s();
    },
  };
}

async function folderWorkspace(path: string): Promise<Workspace> {
  const name = basename(path);
  const entries = await walk(path);
  const recent: RecentItem = { key: `folder:${path}`, kind: "folder", name, at: Date.now(), path };
  pushRecent(recent);
  return makeWorkspace("folder", path, entries, recent);
}

async function fileWorkspace(path: string): Promise<Workspace> {
  // Let relative images next to the file render.
  await invoke("authorize_siblings", { path }).catch(() => false);
  const name = basename(path);
  const recent: RecentItem = { key: `file:${path}`, kind: "file", name, at: Date.now(), path };
  pushRecent(recent);
  return makeWorkspace("file", parentOf(path), [{ rel: name, name, dir: "" }], recent);
}

/** Paths that came from the OS (Finder / Explorer / drag-drop / CLI). Already scoped by Rust. */
export async function workspaceFromPath(path: string): Promise<Workspace | null> {
  try {
    const info = await stat(path);
    return info.isDirectory ? folderWorkspace(path) : fileWorkspace(path);
  } catch {
    return null;
  }
}

export function createTauriPlatform(): Platform {
  const p = osPlatform();
  const kind: PlatformKind = p === "macos" ? "mac" : p === "windows" ? "windows" : "linux";
  return {
    kind,
    isTauri: true,
    persistentRecents: true,
    async pickFile() {
      const path = await open({ multiple: false, directory: false, filters: [{ name: "Markdown", extensions: MD_EXT }] });
      return typeof path === "string" ? fileWorkspace(path) : null;
    },
    async pickFolder() {
      const path = await open({ multiple: false, directory: true, recursive: true });
      return typeof path === "string" ? folderWorkspace(path) : null;
    },
    async openRecent(item) {
      if (!item.path || !(await exists(item.path).catch(() => false))) return null;
      return item.kind === "folder" ? folderWorkspace(item.path) : fileWorkspace(item.path);
    },
    async recents() {
      return loadRecents();
    },
    async forgetRecents() {
      clearRecents();
    },
    async openExternal(url) {
      await openUrl(url);
    },
  };
}
