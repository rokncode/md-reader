import type { RecentItem } from "./types";

const KEY = "qari.recents";
const MAX = 8;

export function loadRecents(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem) {
  try {
    const list = loadRecents().filter((r) => r.key !== item.key);
    list.unshift({ ...item, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}

export function clearRecents() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* Remote (URL) recents are platform-independent. */
const URL_KEY = "qari.urlRecents";

export function loadUrlRecents(): RecentItem[] {
  try {
    const raw = localStorage.getItem(URL_KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

export function pushUrlRecent(item: RecentItem) {
  try {
    const list = loadUrlRecents().filter((r) => r.key !== item.key);
    list.unshift({ ...item, at: Date.now() });
    localStorage.setItem(URL_KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}

export function clearUrlRecents() {
  try {
    localStorage.removeItem(URL_KEY);
  } catch {
    /* ignore */
  }
}
