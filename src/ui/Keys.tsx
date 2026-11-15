import { isMacLike } from "../platform";

const MAC: Record<string, string> = { mod: "⌘", shift: "⇧", alt: "⌥", minus: "−", plus: "+" };
const PC: Record<string, string> = { mod: "Ctrl", shift: "Shift", alt: "Alt", minus: "−", plus: "+" };

/** Renders a shortcut as physical keycaps, e.g. keys="mod shift O". */
export function Keys({ keys, small = false }: { keys: string; small?: boolean }) {
  const map = isMacLike() ? MAC : PC;
  return (
    <span className="keys" dir="ltr" data-small={small || undefined}>
      {keys.split(" ").map((k, i) => (
        <kbd key={i} className="keycap">
          {map[k] ?? k}
        </kbd>
      ))}
    </span>
  );
}

export const SHORTCUTS: { keys: string; label: "openFile" | "openFolder" | "openUrl" | "quickOpen" | "find" | "outline" | "focusMode" | "settings" | "toggleLanguage" }[] = [
  { keys: "mod O", label: "openFile" },
  { keys: "mod shift O", label: "openFolder" },
  { keys: "mod L", label: "openUrl" },
  { keys: "mod P", label: "quickOpen" },
  { keys: "mod F", label: "find" },
  { keys: "mod shift T", label: "outline" },
  { keys: "mod .", label: "focusMode" },
  { keys: "mod shift L", label: "toggleLanguage" },
];
