export type PlatformKind = "mac" | "windows" | "linux" | "web";

/** A Markdown document inside a workspace. `rel` is a '/'-separated path from the workspace root and doubles as its id. */
export type Entry = { rel: string; name: string; dir: string };

export type RecentItem = {
  key: string;
  kind: "file" | "folder";
  name: string;
  at: number;
  /** Desktop only: absolute path. */
  path?: string;
  /** Remote workspaces (GitHub / any https Markdown URL). */
  url?: string;
};

export interface Workspace {
  kind: "file" | "folder";
  name: string;
  entries: Entry[];
  recent?: RecentItem;
  read(rel: string): Promise<{ text: string; mtime: number }>;
  /** Resolve an already-normalized workspace-relative path (may start with ../ on desktop) to a loadable URL. */
  assetUrl(rel: string): Promise<string | null>;
  /** Start watching a document for on-disk changes. Returns a stop function. */
  watch(rel: string, onChange: () => void): () => void;
  /** Where this workspace came from, shown as a hint (path or URL). */
  source?: string;
  /** Remote workspaces: a scheme-less, shareable address for a document (e.g. github.com/o/r/blob/main/a.md). */
  share?(rel: string): string;
  /** Remote single files: follow a relative .md link into a new workspace. */
  openRelative?(rel: string): Promise<Workspace | null>;
  /** Open a non-Markdown local link with the OS (desktop) — optional. */
  openLocal?(rel: string): Promise<void>;
  dispose(): void;
}

export interface Platform {
  kind: PlatformKind;
  isTauri: boolean;
  /** Whether "Recent" survives a restart on this platform. */
  persistentRecents: boolean;
  pickFile(): Promise<Workspace | null>;
  pickFolder(): Promise<Workspace | null>;
  openRecent(item: RecentItem): Promise<Workspace | null>;
  recents(): Promise<RecentItem[]>;
  forgetRecents(): Promise<void>;
  openExternal(url: string): Promise<void>;
}
