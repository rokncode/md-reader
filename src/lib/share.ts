import { useApp } from "../state/app";
import { platform } from "../platform";

/**
 * Shareable addresses: anything after the app's origin is a document to open.
 *   /github.com/owner/repo                      → repo README
 *   /github.com/owner/repo/blob/main/docs/a.md  → that file inside the repo
 *   /https://example.com/notes.md#section       → any Markdown URL, scrolled to a heading
 *   /?open=<url>                                → same, query form
 */
export function readRoute(): { target: string; hash?: string } | null {
  const q = new URLSearchParams(location.search).get("open");
  const hash = location.hash ? decodeURIComponent(location.hash.slice(1)) : undefined;
  if (q) return { target: q, hash };
  let path = location.pathname.replace(/^\/+/, "");
  if (!path || path === "index.html") return null;
  try {
    path = decodeURI(path);
  } catch {
    /* keep raw */
  }
  // Some servers collapse "https://" to "https:/"
  path = path.replace(/^(https?):\/(?!\/)/i, "$1://");
  return { target: path + location.search, hash };
}

const origin = () => (import.meta.env.VITE_SHARE_ORIGIN as string | undefined)?.replace(/\/$/, "") || location.origin;

/** The shareable link for what's on screen, or null for local files. */
export function currentShareLink(withHash = true): string | null {
  const { ws, doc } = useApp.getState();
  if (!ws?.share || !doc) return null;
  if (platform().isTauri && !import.meta.env.VITE_SHARE_ORIGIN) {
    return `https://${ws.share(doc.rel)}`; // desktop without a hosted web app: share the source itself
  }
  const path = encodeURI(ws.share(doc.rel)).replace(/#/g, "%23").replace(/\?/g, "%3F");
  const heading = withHash ? currentHeading() : null;
  return `${origin()}/${path}${heading ? `#${encodeURIComponent(heading)}` : ""}`;
}

function currentHeading() {
  let id: string | null = null;
  for (const h of document.querySelectorAll<HTMLElement>(".prose :is(h1,h2,h3)[id]")) {
    if (h.getBoundingClientRect().top < 140) id = h.id;
    else break;
  }
  return id;
}

/** Keep the browser address bar pointing at the open document (web only). */
export function syncAddressBar() {
  if (platform().isTauri) return () => {};
  return useApp.subscribe((s, prev) => {
    if (s.doc?.rel === prev.doc?.rel && s.ws === prev.ws) return;
    const link = s.ws?.share && s.doc ? currentShareLink(false) : null;
    const next = link ? new URL(link).pathname : "/";
    if (next !== location.pathname) history.replaceState(null, "", next);
  });
}
