import { get, set, del } from "idb-keyval";
import type { Entry, Platform, RecentItem, Workspace } from "./types";
import { isMarkdown, sortEntries, SKIP_DIRS, MAX_FILES, dirnameRel } from "../lib/path";

/* ---------- File System Access API typings (Chromium) ---------- */
type PermissionMode = { mode: "read" | "readwrite" };
type FSHandle = FileSystemHandle & {
  queryPermission?: (d: PermissionMode) => Promise<PermissionState>;
  requestPermission?: (d: PermissionMode) => Promise<PermissionState>;
};
type DirHandle = FileSystemDirectoryHandle & FSHandle & { values(): AsyncIterable<FileSystemHandle> };
type FileHandle = FileSystemFileHandle & FSHandle;

declare global {
  interface Window {
    showOpenFilePicker?: (o?: unknown) => Promise<FileHandle[]>;
    showDirectoryPicker?: (o?: unknown) => Promise<DirHandle>;
    launchQueue?: { setConsumer(cb: (p: { files: FileHandle[] }) => void): void };
  }
  interface DataTransferItem {
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
  }
}

const hasFSA = typeof window !== "undefined" && "showOpenFilePicker" in window && "showDirectoryPicker" in window;
const RECENTS_KEY = "qari.web.recents";

type StoredRecent = RecentItem & { handle?: FileSystemHandle };

async function readRecents(): Promise<StoredRecent[]> {
  try {
    return ((await get(RECENTS_KEY)) as StoredRecent[] | undefined) ?? [];
  } catch {
    return [];
  }
}

async function remember(item: RecentItem, handle: FileSystemHandle) {
  try {
    const list = await readRecents();
    // Same handle → same entry (isSameEntry is async; compare by key + name as a cheap first pass)
    const filtered: StoredRecent[] = [];
    for (const r of list) {
      const same = r.handle && (await r.handle.isSameEntry(handle).catch(() => false));
      if (!same) filtered.push(r);
    }
    filtered.unshift({ ...item, at: Date.now(), handle });
    await set(RECENTS_KEY, filtered.slice(0, 8));
  } catch {
    /* IndexedDB unavailable */
  }
}

async function ensurePermission(h: FSHandle) {
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: "read" })) === "granted") return true;
  return (await h.requestPermission?.({ mode: "read" })) === "granted";
}

function isAbort(e: unknown) {
  return e instanceof DOMException && (e.name === "AbortError" || e.name === "NotAllowedError");
}

function blobCache() {
  const urls = new Map<string, string>();
  return {
    get: (k: string) => urls.get(k),
    put: (k: string, blob: Blob) => {
      const u = URL.createObjectURL(blob);
      urls.set(k, u);
      return u;
    },
    dispose: () => {
      for (const u of urls.values()) URL.revokeObjectURL(u);
      urls.clear();
    },
  };
}

function pollWatcher(getStamp: () => Promise<number>, onChange: () => void) {
  let last = -1;
  let alive = true;
  const tick = async () => {
    if (!alive) return;
    try {
      const s = await getStamp();
      if (last >= 0 && s !== last) onChange();
      last = s;
    } catch {
      /* file vanished */
    }
    if (alive) timer = window.setTimeout(tick, document.hidden ? 4000 : 1500);
  };
  let timer = window.setTimeout(tick, 0);
  return () => {
    alive = false;
    clearTimeout(timer);
  };
}

/* ---------- Workspaces backed by FS Access handles ---------- */

async function walkDir(root: DirHandle): Promise<{ entries: Entry[]; handles: Map<string, FileHandle> }> {
  const entries: Entry[] = [];
  const handles = new Map<string, FileHandle>();
  async function visit(dir: DirHandle, dirRel: string, depth: number) {
    if (depth > 10 || entries.length >= MAX_FILES) return;
    const subs: Promise<void>[] = [];
    for await (const h of dir.values()) {
      if (h.name.startsWith(".")) continue;
      const rel = dirRel ? `${dirRel}/${h.name}` : h.name;
      if (h.kind === "directory") {
        if (!SKIP_DIRS.has(h.name)) subs.push(visit(h as DirHandle, rel, depth + 1));
      } else if (isMarkdown(h.name)) {
        entries.push({ rel, name: h.name, dir: dirRel });
        handles.set(rel, h as FileHandle);
      }
    }
    await Promise.all(subs);
  }
  await visit(root, "", 0);
  return { entries: sortEntries(entries), handles };
}

async function fileAt(root: DirHandle, rel: string): Promise<File | null> {
  if (rel.startsWith("..")) return null;
  const parts = rel.split("/").filter(Boolean);
  let dir: FileSystemDirectoryHandle = root;
  try {
    for (const seg of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(seg);
    const fh = await dir.getFileHandle(parts[parts.length - 1]);
    return await fh.getFile();
  } catch {
    return null;
  }
}

export async function folderFromHandle(root: DirHandle): Promise<Workspace> {
  const { entries, handles } = await walkDir(root);
  const cache = blobCache();
  const stops = new Set<() => void>();
  const recent: RecentItem = { key: `folder:${root.name}`, kind: "folder", name: root.name, at: Date.now() };
  void remember(recent, root);
  return {
    kind: "folder",
    name: root.name,
    entries,
    recent,
    async read(rel) {
      const h = handles.get(rel);
      const file = h ? await h.getFile() : await fileAt(root, rel);
      if (!file) throw new Error("not found");
      return { text: await file.text(), mtime: file.lastModified };
    },
    async assetUrl(rel) {
      const hit = cache.get(rel);
      if (hit) return hit;
      const f = await fileAt(root, rel);
      return f ? cache.put(rel, f) : null;
    },
    watch(rel, onChange) {
      const h = handles.get(rel);
      if (!h) return () => {};
      const stop = pollWatcher(async () => (await h.getFile()).lastModified, onChange);
      stops.add(stop);
      return () => {
        stop();
        stops.delete(stop);
      };
    },
    dispose() {
      stops.forEach((s) => s());
      cache.dispose();
    },
  };
}

export function fileFromHandle(h: FileHandle): Workspace {
  const stops = new Set<() => void>();
  const recent: RecentItem = { key: `file:${h.name}`, kind: "file", name: h.name, at: Date.now() };
  void remember(recent, h);
  return {
    kind: "file",
    name: h.name,
    entries: [{ rel: h.name, name: h.name, dir: "" }],
    recent,
    async read() {
      const f = await h.getFile();
      return { text: await f.text(), mtime: f.lastModified };
    },
    async assetUrl() {
      return null; // no access to siblings from a single file handle
    },
    watch(_rel, onChange) {
      const stop = pollWatcher(async () => (await h.getFile()).lastModified, onChange);
      stops.add(stop);
      return stop;
    },
    dispose() {
      stops.forEach((s) => s());
    },
  };
}

/* ---------- Fallback: plain File / FileList (Safari, Firefox) ---------- */

export function fromFiles(files: File[], folderName?: string): Workspace | null {
  const byRel = new Map<string, File>();
  for (const f of files) {
    const wr = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    const rel = wr ? wr.split("/").slice(1).join("/") : f.name;
    if (rel.split("/").some((s) => s.startsWith(".") || SKIP_DIRS.has(s))) continue;
    byRel.set(rel, f);
  }
  const entries = sortEntries(
    [...byRel.keys()].filter(isMarkdown).map((rel) => ({ rel, name: rel.split("/").pop()!, dir: dirnameRel(rel) })),
  );
  if (!entries.length && !folderName) return null;
  const cache = blobCache();
  const single = !folderName;
  return {
    kind: single ? "file" : "folder",
    name: folderName ?? entries[0].name,
    entries,
    async read(rel) {
      const f = byRel.get(rel);
      if (!f) throw new Error("not found");
      return { text: await f.text(), mtime: f.lastModified };
    },
    async assetUrl(rel) {
      const hit = cache.get(rel);
      if (hit) return hit;
      const f = byRel.get(rel);
      return f ? cache.put(rel, f) : null;
    },
    watch: () => () => {},
    dispose: () => cache.dispose(),
  };
}

function pickViaInput(dir: boolean): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (dir) (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    else input.accept = ".md,.markdown,.mdown,.mkd,text/markdown";
    input.style.display = "none";
    input.addEventListener("change", () => {
      resolve(input.files?.length ? [...input.files] : null);
      input.remove();
    });
    input.addEventListener("cancel", () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

/** Drag-and-drop on the web: prefer real handles (Chromium), else fall back to File objects. */
export async function workspaceFromDrop(dt: DataTransfer): Promise<Workspace | null> {
  const item = [...dt.items].find((i) => i.kind === "file");
  if (item?.getAsFileSystemHandle) {
    const h = await item.getAsFileSystemHandle();
    if (h?.kind === "directory") return folderFromHandle(h as DirHandle);
    if (h?.kind === "file" && isMarkdown(h.name)) return fileFromHandle(h as FileHandle);
  }
  const file = [...dt.files].find((f) => isMarkdown(f.name));
  return file ? fromFiles([file]) : null;
}

export function createWebPlatform(): Platform {
  return {
    kind: "web",
    isTauri: false,
    persistentRecents: hasFSA,
    async pickFile() {
      if (hasFSA) {
        try {
          const [h] = await window.showOpenFilePicker!({
            id: "qari-file",
            types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown", ".mdown", ".mkd"] } }],
            excludeAcceptAllOption: false,
          });
          return fileFromHandle(h);
        } catch (e) {
          if (isAbort(e)) return null;
          throw e;
        }
      }
      const files = await pickViaInput(false);
      return files ? fromFiles(files) : null;
    },
    async pickFolder() {
      if (hasFSA) {
        try {
          const h = await window.showDirectoryPicker!({ id: "qari-folder", mode: "read" });
          return folderFromHandle(h);
        } catch (e) {
          if (isAbort(e)) return null;
          throw e;
        }
      }
      const files = await pickViaInput(true);
      if (!files) return null;
      const first = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/")[0];
      return fromFiles(files, first || "Folder");
    },
    async openRecent(item) {
      const list = await readRecents();
      const hit = list.find((r) => r.key === item.key && r.at === item.at) ?? list.find((r) => r.key === item.key);
      const h = hit?.handle as FSHandle | undefined;
      if (!h || !(await ensurePermission(h))) return null;
      return h.kind === "directory" ? folderFromHandle(h as DirHandle) : fileFromHandle(h as FileHandle);
    },
    async recents() {
      return (await readRecents()).map(({ handle: _h, ...r }) => r);
    },
    async forgetRecents() {
      await del(RECENTS_KEY).catch(() => {});
    },
    async openExternal(url) {
      window.open(url, "_blank", "noopener,noreferrer");
    },
  };
}
