import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronUp, ChevronDown, X, Search } from "lucide-react";
import { useApp } from "../state/app";
import { useT } from "../i18n";
import { materialize, spring } from "./motion";

type HighlightRegistry = { set(n: string, h: unknown): void; delete(n: string): void };
const registry = (globalThis.CSS as unknown as { highlights?: HighlightRegistry })?.highlights;
const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;

// Arabic diacritics + tatweel are ignored while matching so "كتاب" finds "كِتَاب".
const IGNORABLE = /[ً-ٰٟـ]/;

function buildIndex(root: HTMLElement) {
  const nodes: { node: Text; start: number; map: number[] }[] = [];
  let flat = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const map: number[] = [];
    const start = flat.length;
    const data = n.data;
    for (let i = 0; i < data.length; i++) {
      if (IGNORABLE.test(data[i])) continue;
      flat += data[i].toLocaleLowerCase();
      map.push(i);
    }
    flat += "\u0000"; // never match across text nodes
    map.push(data.length);
    nodes.push({ node: n, start, map });
  }
  return { flat, nodes };
}

function find(root: HTMLElement, q: string): Range[] {
  const needle = [...q.toLocaleLowerCase()].filter((c) => !IGNORABLE.test(c)).join("");
  if (!needle) return [];
  const { flat, nodes } = buildIndex(root);
  const out: Range[] = [];
  let ni = 0;
  for (let at = flat.indexOf(needle); at >= 0 && out.length < 2000; at = flat.indexOf(needle, at + needle.length)) {
    while (ni < nodes.length - 1 && nodes[ni + 1].start <= at) ni++;
    const { node, start, map } = nodes[ni];
    const a = map[at - start];
    const b = map[at - start + needle.length - 1] + 1;
    if (a === undefined || b === undefined) continue;
    const r = document.createRange();
    r.setStart(node, a);
    r.setEnd(node, Math.min(b, node.length));
    out.push(r);
  }
  return out;
}

export function FindBar() {
  const t = useT();
  const doc = useApp((s) => s.doc);
  const set = useApp((s) => s.set);
  const [q, setQ] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [cur, setCur] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".prose");
    const id = setTimeout(() => {
      const r = root ? find(root, q) : [];
      setRanges(r);
      setCur(0);
    }, 60);
    return () => clearTimeout(id);
  }, [q, doc?.tree]);

  const reveal = useCallback((r: Range | undefined) => {
    if (!r) return;
    const scroller = document.querySelector<HTMLElement>(".scroller");
    const rect = r.getBoundingClientRect();
    if (!scroller) return;
    const margin = 120;
    if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
      scroller.scrollBy({ top: rect.top - window.innerHeight / 2.6, behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    if (!registry || !HighlightCtor) return;
    registry.set("qari-find", new HighlightCtor(...ranges.filter((_, i) => i !== cur)));
    registry.set("qari-find-current", new HighlightCtor(...(ranges[cur] ? [ranges[cur]] : [])));
    reveal(ranges[cur]);
  }, [ranges, cur, reveal]);

  useEffect(
    () => () => {
      registry?.delete("qari-find");
      registry?.delete("qari-find-current");
    },
    [],
  );

  const step = (d: number) => ranges.length && setCur((c) => (c + d + ranges.length) % ranges.length);
  const close = () => set({ find: false });

  return (
    <motion.div
      className="glass-thick fixed z-[50] flex items-center gap-1"
      style={{
        top: "calc(var(--titlebar-h) + 6px)",
        insetInlineEnd: 16,
        height: 44,
        padding: "0 6px 0 12px",
        borderRadius: 999,
        width: "min(380px, calc(100vw - 32px))",
        transformOrigin: "top",
      }}
      {...materialize}
      transition={spring}
      role="search"
    >
      <Search size={15} style={{ color: "var(--text-3)", flex: "none" }} />
      <input
        ref={input}
        value={q}
        dir="auto"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
        placeholder={t("findPlaceholder")}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none"
        style={{ fontSize: 14, paddingInline: 6 }}
      />
      <span className="kbd" style={{ minWidth: 44, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {q ? (ranges.length ? `${cur + 1}/${ranges.length}` : t("findNone")) : ""}
      </span>
      <button className="icon-btn" onClick={() => step(-1)} disabled={!ranges.length} aria-label={t("prev")}>
        <ChevronUp />
      </button>
      <button className="icon-btn" onClick={() => step(1)} disabled={!ranges.length} aria-label={t("next")}>
        <ChevronDown />
      </button>
      <button className="icon-btn" onClick={close} aria-label={t("close")}>
        <X />
      </button>
    </motion.div>
  );
}
