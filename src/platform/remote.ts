import { isTauri } from "@tauri-apps/api/core";
import type { Entry, RecentItem, Workspace } from "./types";
import { isMarkdown, sortEntries, SKIP_DIRS, MAX_FILES, dirnameRel } from "../lib/path";
import { pushUrlRecent } from "./recents";

/** Desktop goes through the Rust HTTP client (no CORS); the web uses fetch. */
async function http(url: string): Promise<Response> {
  if (isTauri()) {
    const { fetch } = await import("@tauri-apps/plugin-http");
    return fetch(url, { method: "GET" });
  }
  return fetch(url, { mode: "cors" });
}

async function json<T>(url: string): Promise<T> {
  const r = await http(url);
  if (!r.ok) throw new Error(`${r.status}`);
  return (await r.json()) as T;
}

const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

type GitHubRef = { owner: string; repo: string; ref?: string; path: string; kind: "repo" | "tree" | "blob" };

/** github.com/o/r, github.com/o/r/tree/ref/dir, github.com/o/r/blob/ref/file.md, raw.githubusercontent.com/o/r/ref/file.md, or "o/r". */
export function parseGitHub(input: string): GitHubRef | null {
  const short = /^([\w.-]+)\/([\w.-]+)$/.exec(input.trim());
  if (short) return { owner: short[1], repo: short[2].replace(/\.git$/, ""), path: "", kind: "repo" };
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  const parts = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (u.hostname === "github.com" || u.hostname === "www.github.com") {
    if (parts.length < 2) return null;
    const [owner, repoRaw, mode, ref, ...rest] = parts;
    const repo = repoRaw.replace(/\.git$/, "");
    if ((mode === "tree" || mode === "blob") && ref) return { owner, repo, ref, path: rest.join("/"), kind: mode };
    return { owner, repo, path: "", kind: "repo" };
  }
  if (u.hostname === "raw.githubusercontent.com" && parts.length >= 4) {
    const [owner, repo, ref, ...rest] = parts;
    return { owner, repo, ref, path: rest.join("/"), kind: "blob" };
  }
  return null;
}

type Tree = { tree: { path: string; type: "blob" | "tree" }[]; truncated: boolean };

async function githubWorkspace(gh: GitHubRef): Promise<{ ws: Workspace; initial?: string }> {
  const api = `https://api.github.com/repos/${gh.owner}/${gh.repo}`;
  const ref = gh.ref ?? (await json<{ default_branch: string }>(api)).default_branch;
  const tree = await json<Tree>(`${api}/git/trees/${encodeURIComponent(ref)}?recursive=1`);

  // A blob opens the whole repo (so its links work) at that file; a tree opens just that folder.
  const root = gh.kind === "tree" ? gh.path.replace(/\/$/, "") : "";
  const entries: Entry[] = [];
  for (const t of tree.tree) {
    if (t.type !== "blob" || !isMarkdown(t.path)) continue;
    if (root && !t.path.startsWith(`${root}/`)) continue;
    const rel = root ? t.path.slice(root.length + 1) : t.path;
    if (rel.split("/").some((seg) => seg.startsWith(".") || SKIP_DIRS.has(seg))) continue;
    entries.push({ rel, name: rel.split("/").pop()!, dir: dirnameRel(rel) });
    if (entries.length >= MAX_FILES) break;
  }
  const base = `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${encodeURIComponent(ref)}/${root ? `${encodePath(root)}/` : ""}`;
  const name = root ? root.split("/").pop()! : gh.repo;
  const source = `github.com/${gh.owner}/${gh.repo}${root ? `/${root}` : ""}`;
  const url = `https://github.com/${gh.owner}/${gh.repo}${root ? `/tree/${ref}/${root}` : ""}`;
  const recent: RecentItem = { key: `url:${url}`, kind: "folder", name, at: Date.now(), url };
  pushUrlRecent(recent);

  const ws: Workspace = {
    kind: "folder",
    name,
    source,
    entries: sortEntries(entries),
    recent,
    async read(rel) {
      const r = await http(base + encodePath(rel));
      if (!r.ok) throw new Error(`${r.status}`);
      return { text: await r.text(), mtime: 0 };
    },
    async assetUrl(rel) {
      return new URL(encodePath(rel), base).href;
    },
    share(rel) {
      return `github.com/${gh.owner}/${gh.repo}/blob/${ref}/${root ? `${root}/` : ""}${rel}`;
    },
    watch: () => () => {},
    dispose() {},
  };
  return { ws, initial: gh.kind === "blob" && gh.path ? gh.path : undefined };
}

async function fileWorkspace(url: string): Promise<Workspace> {
  const r = await http(url);
  if (!r.ok) throw new Error(`${r.status}`);
  const text = await r.text();
  const u = new URL(r.url || url);
  const name = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? u.hostname);
  const base = new URL(".", u).href;
  const recent: RecentItem = { key: `url:${url}`, kind: "file", name, at: Date.now(), url };
  pushUrlRecent(recent);
  let first = true;
  return {
    kind: "file",
    name,
    source: u.host + u.pathname,
    entries: [{ rel: name, name, dir: "" }],
    recent,
    async read() {
      if (first) {
        first = false;
        return { text, mtime: 0 };
      }
      const again = await http(url);
      return { text: await again.text(), mtime: Date.now() };
    },
    async assetUrl(rel) {
      return new URL(encodePath(rel), base).href;
    },
    share() {
      return url.replace(/^https:\/\//, "");
    },
    async openRelative(rel) {
      return isMarkdown(rel) ? fileWorkspace(new URL(encodePath(rel), base).href) : null;
    },
    watch: () => () => {},
    dispose() {},
  };
}

/** Normalise user input ("owner/repo", bare host, full URL) into something openable. */
export function normaliseUrl(input: string) {
  const s = input.trim();
  if (!s) return null;
  if (parseGitHub(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return `https://${s}`;
  return null;
}

export async function workspaceFromUrl(input: string): Promise<{ ws: Workspace; initial?: string }> {
  const s = normaliseUrl(input);
  if (!s) throw new Error("invalid");
  const gh = parseGitHub(s);
  if (gh) return githubWorkspace(gh);
  return { ws: await fileWorkspace(s) };
}
