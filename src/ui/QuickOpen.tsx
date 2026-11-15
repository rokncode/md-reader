import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { FileText, Search } from "lucide-react";
import { useApp } from "../state/app";
import { useT } from "../i18n";
import { stripExt } from "../lib/path";
import { materialize, spring } from "./motion";

/** Subsequence score — contiguous hits and filename hits weigh more. */
function score(rel: string, name: string, q: string) {
  if (!q) return 1;
  const hay = rel.toLocaleLowerCase();
  const direct = name.toLocaleLowerCase().indexOf(q);
  if (direct >= 0) return 1000 - direct;
  const inPath = hay.indexOf(q);
  if (inPath >= 0) return 600 - inPath;
  let s = 0;
  let last = -1;
  for (const ch of q) {
    const i = hay.indexOf(ch, last + 1);
    if (i < 0) return 0;
    s += i === last + 1 ? 6 : 1;
    last = i;
  }
  return s;
}

export function QuickOpen() {
  const t = useT();
  const ws = useApp((s) => s.ws)!;
  const doc = useApp((s) => s.doc);
  const openDoc = useApp((s) => s.openDoc);
  const setPanel = useApp((s) => s.setPanel);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    return ws.entries
      .map((e) => ({ e, s: score(e.rel, e.name, needle) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 60)
      .map((x) => x.e);
  }, [ws, q]);

  useEffect(() => {
    setSel(0);
  }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const choose = (i: number) => {
    const e = results[i];
    if (e) void openDoc(e.rel);
    setPanel(null);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(results.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(sel);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[69]" onPointerDown={() => setPanel(null)} />
      <motion.div
        className="glass-thick fixed z-[70] inset-x-0 mx-auto flex flex-col overflow-hidden"
        style={{ top: "13vh", width: "min(580px, calc(100vw - 32px))", maxHeight: "62vh", borderRadius: "var(--r-xl)", transformOrigin: "50% 0" }}
        {...materialize}
        transition={spring}
        role="dialog"
        aria-label={t("quickOpen")}
      >
        <div className="flex items-center gap-3 px-5" style={{ height: 56 }}>
          <Search size={20} style={{ color: "var(--text-3)" }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("quickOpenPlaceholder")}
            dir="auto"
            className="flex-1 bg-transparent outline-none border-0"
            style={{ fontSize: 19, fontWeight: 500 }}
            role="combobox"
            aria-expanded
            aria-controls="qo-list"
          />
        </div>
        <div className="menu-sep" style={{ margin: 0 }} />
        <div ref={listRef} id="qo-list" role="listbox" className="overflow-y-auto p-1.5">
          {results.length === 0 ? <div className="menu-label py-4 text-center">{t("noMatches")}</div> : null}
          {results.map((e, i) => (
            <button
              key={e.rel}
              data-index={i}
              role="option"
              aria-selected={i === sel}
              className="menu-item"
              data-active={i === sel}
              data-current={e.rel === doc?.rel && i !== sel}
              style={{ minHeight: 42 }}
              onPointerMove={() => setSel(i)}
              onClick={() => choose(i)}
            >
              <FileText />
              <span className="grow" dir="auto" style={{ fontWeight: 600 }}>
                {stripExt(e.name)}
              </span>
              {e.dir ? (
                <span className="kbd" dir="auto" style={{ maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.dir}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}
