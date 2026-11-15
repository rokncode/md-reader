import { isTauri } from "@tauri-apps/api/core";
import type { Platform } from "./types";

let current: Platform | null = null;

/** Resolve the platform once at boot. Tauri modules are only imported inside the desktop shell. */
export async function initPlatform(): Promise<Platform> {
  if (current) return current;
  if (isTauri()) {
    const { createTauriPlatform } = await import("./tauri");
    current = createTauriPlatform();
  } else {
    const { createWebPlatform } = await import("./web");
    current = createWebPlatform();
  }
  document.documentElement.dataset.platform = current.kind;
  return current;
}

export function platform(): Platform {
  if (!current) throw new Error("platform not initialised");
  return current;
}

export const isMacLike = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export * from "./types";
