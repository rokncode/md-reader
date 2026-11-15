export const MD_EXT = ["md", "markdown", "mdown", "mkd"];

export function isMarkdown(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MD_EXT.includes(ext);
}

export function basename(p: string) {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

export function dirnameRel(rel: string) {
  const i = rel.lastIndexOf("/");
  return i < 0 ? "" : rel.slice(0, i);
}

export function stripExt(name: string) {
  return name.replace(/\.(md|markdown|mdown|mkd)$/i, "");
}

/** Split an href into path + hash, decoding the path. */
export function splitHref(href: string): { path: string; hash: string } {
  const hashAt = href.indexOf("#");
  const rawPath = hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt + 1);
  const pathOnly = rawPath.split("?")[0];
  let path = pathOnly;
  try {
    path = decodeURIComponent(pathOnly);
  } catch {
    /* keep raw */
  }
  return { path, hash };
}

/** Resolve `href` relative to the document at `fromRel`. Leading "/" means workspace root. */
export function resolveRel(fromRel: string, hrefPath: string): string {
  const stack = hrefPath.startsWith("/") ? [] : dirnameRel(fromRel).split("/").filter(Boolean);
  for (const seg of hrefPath.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      if (stack.length && stack[stack.length - 1] !== "..") stack.pop();
      else stack.push("..");
    } else stack.push(seg);
  }
  return stack.join("/");
}

export function isExternal(href: string) {
  return /^(https?:|mailto:|tel:)/i.test(href);
}

export function isInlineSrc(src: string) {
  return /^(https?:|data:|blob:)/i.test(src);
}

export function sortEntries<T extends { rel: string }>(list: T[]): T[] {
  const collator = new Intl.Collator(["ar", "en"], { numeric: true, sensitivity: "base" });
  return list.sort((a, b) => {
    const da = a.rel.split("/").length;
    const db = b.rel.split("/").length;
    // Root files first, then by path
    if ((da === 1) !== (db === 1)) return da === 1 ? -1 : 1;
    const ra = /(^|\/)readme\.md$/i.test(a.rel);
    const rb = /(^|\/)readme\.md$/i.test(b.rel);
    if (ra !== rb && dirnameRel(a.rel) === dirnameRel(b.rel)) return ra ? -1 : 1;
    return collator.compare(a.rel, b.rel);
  });
}

export const SKIP_DIRS = new Set(["node_modules", ".git", ".svn", ".hg", "vendor", "target", "dist", "build", ".next", ".cache"]);
export const MAX_FILES = 5000;
