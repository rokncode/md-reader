/**
 * Bundled (offline) fonts, registered lazily through the FontFace API.
 *
 * Every Arabic face is restricted to the Arabic unicode-range, so the stack
 *   font-family: var(--font-ar), var(--font-en), system-ui
 * renders Arabic glyphs with the chosen Arabic font while Latin text falls
 * through to the chosen English font — in the same paragraph.
 */

type UrlModule = { default: string };
type Face = { weight: string; load: () => Promise<UrlModule> };

export type FontDef = {
  id: string;
  label: string; // shown in its own script
  faces: Face[]; // empty = platform font, nothing to download
  stack?: string; // used instead of a registered family (system fonts)
};

export const AR_RANGE =
  "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC,U+102E0-102FB,U+10E60-10E7E,U+10EC2-10EC4,U+10EFC-10EFF,U+1EE00-1EEFF";

export const ARABIC_FONTS: FontDef[] = [
  {
    id: "noto",
    label: "نوتو سانس",
    faces: [
      {
        weight: "100 900",
        load: () => import("@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2?url"),
      },
    ],
  },
  {
    id: "tajawal",
    label: "تجوّل",
    faces: [
      { weight: "400", load: () => import("@fontsource/tajawal/files/tajawal-arabic-400-normal.woff2?url") },
      { weight: "500", load: () => import("@fontsource/tajawal/files/tajawal-arabic-500-normal.woff2?url") },
      { weight: "700", load: () => import("@fontsource/tajawal/files/tajawal-arabic-700-normal.woff2?url") },
      { weight: "800", load: () => import("@fontsource/tajawal/files/tajawal-arabic-800-normal.woff2?url") },
    ],
  },
  {
    id: "rubik",
    label: "روبيك",
    faces: [{ weight: "300 900", load: () => import("@fontsource-variable/rubik/files/rubik-arabic-wght-normal.woff2?url") }],
  },
  {
    id: "plex",
    label: "آي بي إم بلكس",
    faces: [
      { weight: "400", load: () => import("@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2?url") },
      { weight: "500", load: () => import("@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-500-normal.woff2?url") },
      { weight: "600", load: () => import("@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2?url") },
      { weight: "700", load: () => import("@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2?url") },
    ],
  },
  {
    id: "vazirmatn",
    label: "فزيرمتن",
    faces: [{ weight: "100 900", load: () => import("@fontsource-variable/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2?url") }],
  },
];

export const SYSTEM_STACK = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif`;

export const ENGLISH_FONTS: FontDef[] = [
  { id: "system", label: "System", faces: [], stack: SYSTEM_STACK },
  {
    id: "inter",
    label: "Inter",
    faces: [{ weight: "100 900", load: () => import("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url") }],
  },
  {
    id: "plex",
    label: "IBM Plex Sans",
    faces: [
      { weight: "400", load: () => import("@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url") },
      { weight: "500", load: () => import("@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2?url") },
      { weight: "600", load: () => import("@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url") },
      { weight: "700", load: () => import("@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2?url") },
    ],
  },
  {
    id: "rubik",
    label: "Rubik",
    faces: [{ weight: "300 900", load: () => import("@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2?url") }],
  },
];

export type Role = "ar" | "en";

const registered = new Map<string, Promise<void>>();

export function familyName(role: Role, id: string) {
  return `qari-${role}-${id}`;
}

function defsFor(role: Role) {
  return role === "ar" ? ARABIC_FONTS : ENGLISH_FONTS;
}

export function findFont(role: Role, id: string): FontDef {
  const list = defsFor(role);
  return list.find((f) => f.id === id) ?? list[0];
}

/** Register (once) and load every face of a font; resolves when ready to paint. */
export function ensureFont(role: Role, id: string): Promise<void> {
  const def = findFont(role, id);
  const key = familyName(role, def.id);
  if (!def.faces.length) return Promise.resolve();
  let p = registered.get(key);
  if (!p) {
    p = Promise.all(
      def.faces.map(async (face) => {
        const { default: url } = await face.load();
        const ff = new FontFace(key, `url("${url}") format("woff2")`, {
          weight: face.weight,
          style: "normal",
          display: "swap",
          ...(role === "ar" ? { unicodeRange: AR_RANGE } : {}),
        });
        document.fonts.add(ff);
        await ff.load();
      }),
    ).then(() => undefined);
    p.catch(() => registered.delete(key));
    registered.set(key, p);
  }
  return p;
}

export function cssFamily(role: Role, id: string): string {
  const def = findFont(role, id);
  return def.stack ?? `"${familyName(role, def.id)}"`;
}

/** Apply the chosen pair to the document via CSS custom properties. */
export async function applyFonts(arId: string, enId: string) {
  const root = document.documentElement;
  root.style.setProperty("--font-ar", cssFamily("ar", arId));
  root.style.setProperty("--font-en", cssFamily("en", enId));
  await Promise.allSettled([ensureFont("ar", arId), ensureFont("en", enId)]);
}
