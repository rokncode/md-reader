import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";
export type Measure = "narrow" | "normal" | "wide";
export type Leading = "compact" | "normal" | "relaxed";

export type Settings = {
  lang: "ar" | "en";
  theme: Theme;
  fontAr: string;
  fontEn: string;
  fontSize: number;
  measure: Measure;
  leading: Leading;
  glass: boolean;
};

export const DEFAULTS: Settings = {
  lang: "ar",
  theme: "system",
  fontAr: "noto",
  fontEn: "system",
  fontSize: 18,
  measure: "normal",
  leading: "normal",
  glass: true,
};

export const FONT_MIN = 14;
export const FONT_MAX = 28;

/** localStorage can throw (private mode, blocked storage) — never let it break the app. */
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

type Actions = {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  bumpFont: (delta: number) => void;
  resetFont: () => void;
};

export const useSettings = create<Settings & Actions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      bumpFont: (d) => set((s) => ({ fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, s.fontSize + d)) })),
      resetFont: () => set({ fontSize: DEFAULTS.fontSize }),
    }),
    { name: "qari.settings", storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
);
