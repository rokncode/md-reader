import { create } from "zustand";
import type { Workspace } from "../platform/types";
import { renderMarkdown, type Rendered } from "../markdown/pipeline";

export type Panel = null | "quick" | "settings" | "folder" | "outline" | "type" | "open" | "url";

export type Doc = Rendered & { rel: string; name: string; mtime: number; version: number };

type State = {
  ws: Workspace | null;
  doc: Doc | null;
  loading: boolean;
  /** What is being opened (URL / name) while a workspace is still being fetched. */
  opening: string | null;
  error: string | null;
  panel: Panel;
  /** Element that opened the current popover — used as the transform origin. */
  anchor: DOMRect | null;
  find: boolean;
  focus: boolean;
  dragging: boolean;
  toast: string | null;
  pendingHash: string | null;
  /** Toolbar tucked away while reading downward. */
  chromeHidden: boolean;
  scrolled: boolean;
};

type Actions = {
  openWorkspace: (ws: Workspace | null, rel?: string, hash?: string) => Promise<void>;
  openDoc: (rel: string, hash?: string) => Promise<void>;
  reload: () => Promise<void>;
  step: (dir: 1 | -1) => void;
  closeWorkspace: () => void;
  setPanel: (p: Panel, anchor?: Element | null) => void;
  togglePanel: (p: Exclude<Panel, null>, anchor?: Element | null) => void;
  set: (s: Partial<State>) => void;
  notify: (msg: string) => void;
};

let stopWatch: (() => void) | null = null;
let toastTimer = 0;
let seq = 0;

export const scrollMemory = new Map<string, number>();

export const useApp = create<State & Actions>()((set, get) => ({
  ws: null,
  doc: null,
  loading: false,
  opening: null,
  error: null,
  panel: null,
  anchor: null,
  find: false,
  focus: false,
  dragging: false,
  toast: null,
  pendingHash: null,
  chromeHidden: false,
  scrolled: false,

  async openWorkspace(ws, rel, hash) {
    if (!ws) return;
    const prev = get().ws;
    stopWatch?.();
    stopWatch = null;
    if (prev && prev !== ws) prev.dispose();
    scrollMemory.clear();
    set({ ws, doc: null, error: null, panel: null });
    const target = rel ?? ws.entries[0]?.rel;
    if (target) await get().openDoc(target, hash);
    else set({ error: "emptyFolder", loading: false, opening: null });
  },

  async openDoc(rel, hash) {
    const { ws, doc } = get();
    if (!ws) return;
    if (doc?.rel === rel) {
      if (hash) set({ pendingHash: hash });
      return;
    }
    const my = ++seq;
    set({ loading: true, error: null, panel: null });
    try {
      const { text, mtime } = await ws.read(rel);
      const rendered = await renderMarkdown(text);
      if (my !== seq) return;
      const entry = ws.entries.find((e) => e.rel === rel);
      stopWatch?.();
      stopWatch = ws.watch(rel, () => void get().reload());
      set({
        doc: { ...rendered, rel, name: entry?.name ?? rel.split("/").pop()!, mtime, version: 0 },
        loading: false,
        opening: null,
        pendingHash: hash ?? null,
      });
    } catch {
      if (my === seq) set({ loading: false, opening: null, error: "errorRead" });
    }
  },

  async reload() {
    const { ws, doc } = get();
    if (!ws || !doc) return;
    try {
      const { text, mtime } = await ws.read(doc.rel);
      if (mtime === doc.mtime && doc.version > 0) return;
      const rendered = await renderMarkdown(text);
      const cur = get().doc;
      if (cur?.rel !== doc.rel) return;
      set({ doc: { ...cur, ...rendered, mtime, version: cur.version + 1 } });
    } catch {
      /* file mid-save; next event will catch up */
    }
  },

  step(dir) {
    const { ws, doc } = get();
    if (!ws || !doc || ws.entries.length < 2) return;
    const i = ws.entries.findIndex((e) => e.rel === doc.rel);
    const next = ws.entries[(i + dir + ws.entries.length) % ws.entries.length];
    void get().openDoc(next.rel);
  },

  closeWorkspace() {
    stopWatch?.();
    stopWatch = null;
    get().ws?.dispose();
    set({ ws: null, doc: null, error: null, panel: null, find: false });
  },

  setPanel(p, anchor) {
    set({ panel: p, anchor: anchor ? anchor.getBoundingClientRect() : null });
  },
  togglePanel(p, anchor) {
    const open = get().panel === p;
    get().setPanel(open ? null : p, anchor);
  },
  set: (s) => set(s),
  notify(msg) {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = window.setTimeout(() => set({ toast: null }), 2200);
  },
}));
