import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { FileText, FolderOpen, Clock, X, Folder, Search, Link2, Globe } from "lucide-react";
import { Popover } from "./Popover";
import { TypographyControls } from "./controls";
import { useApp } from "../state/app";
import { useT } from "../i18n";
import { platform, isMacLike } from "../platform";
import type { RecentItem } from "../platform/types";
import { openFile, openFolder, openRecent, run } from "../actions";
import { scrollToId } from "../markdown/Content";
import { stripExt } from "../lib/path";

export const mod = () => (isMacLike() ? "⌘" : "Ctrl+");
export const shift = () => (isMacLike() ? "⇧" : "Shift+");

export function useRecents(dep?: unknown) {
  const [items, setItems] = useState<RecentItem[]>([]);
  useEffect(() => {
    let alive = true;
    void Promise.all([platform().recents(), import("../platform/recents").then((m) => m.loadUrlRecents())]).then(([local, urls]) => {
      if (alive) setItems([...local, ...urls].sort((a, b) => b.at - a.at));
    });
    return () => {
      alive = false;
    };
  }, [dep]);
  return [items, setItems] as const;
}

function OpenMenu() {
  const t = useT();
  const ws = useApp((s) => s.ws);
  const close = useApp((s) => s.closeWorkspace);
  const setPanel = useApp((s) => s.setPanel);
  const [recents] = useRecents();
  const act = (fn: () => unknown) => () => {
    setPanel(null);
    void fn();
  };
  return (
    <Popover width={290} label={t("open")}>
      <button className="menu-item" onClick={act(openFile)}>
        <FileText />
        <span className="grow">{t("openFile")}</span>
        <kbd>{mod()}O</kbd>
      </button>
      <button className="menu-item" onClick={act(openFolder)}>
        <FolderOpen />
        <span className="grow">{t("openFolder")}</span>
        <kbd>
          {shift()}
          {mod()}O
        </kbd>
      </button>
      <button className="menu-item" onClick={act(() => run("open_url"))}>
        <Link2 />
        <span className="grow">{t("openUrl")}</span>
        <kbd>{mod()}L</kbd>
      </button>
      {recents.length ? (
        <>
          <div className="menu-sep" />
          <div className="menu-label">{t("recent")}</div>
          {recents.slice(0, 6).map((r) => (
            <button key={r.key + r.at} className="menu-item" onClick={act(() => openRecent(r))} title={r.path ?? r.name}>
              {r.url ? <Globe /> : r.kind === "folder" ? <Folder /> : <Clock />}
              <span className="grow" dir="auto">
                {r.kind === "file" ? stripExt(r.name) : r.name}
              </span>
            </button>
          ))}
        </>
      ) : null}
      {ws ? (
        <>
          <div className="menu-sep" />
          <button className="menu-item" onClick={act(close)}>
            <X />
            <span className="grow">{t("close")}</span>
          </button>
        </>
      ) : null}
    </Popover>
  );
}

function FolderPanel() {
  const t = useT();
  const ws = useApp((s) => s.ws)!;
  const doc = useApp((s) => s.doc);
  const openDoc = useApp((s) => s.openDoc);
  const [q, setQ] = useState("");
  const current = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    current.current?.scrollIntoView({ block: "center" });
  }, []);
  const groups = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    const map = new Map<string, typeof ws.entries>();
    for (const e of ws.entries) {
      if (needle && !e.rel.toLocaleLowerCase().includes(needle)) continue;
      const arr = map.get(e.dir) ?? [];
      arr.push(e);
      map.set(e.dir, arr);
    }
    return [...map.entries()];
  }, [ws, q]);
  return (
    <Popover width={360} label={t("files")}>
      <div className="row" style={{ minHeight: 38, padding: "2px 8px 6px" }}>
        <Search size={15} style={{ color: "var(--text-3)" }} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("quickOpenPlaceholder")}
          style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontSize: 13.5 }}
          dir="auto"
        />
        <span className="kbd">{t("filesCount", { n: ws.entries.length })}</span>
      </div>
      <div className="menu-sep" style={{ marginTop: 0 }} />
      {groups.length === 0 ? <div className="menu-label">{t("noMatches")}</div> : null}
      {groups.map(([dir, items]) => (
        <div key={dir}>
          {dir ? (
            <div className="menu-label" dir="auto">
              {dir.split("/").join(" / ")}
            </div>
          ) : null}
          {items.map((e) => {
            const isCur = e.rel === doc?.rel;
            return (
              <button
                key={e.rel}
                ref={isCur ? current : undefined}
                className="menu-item"
                data-current={isCur}
                onClick={() => void openDoc(e.rel)}
              >
                <FileText />
                <span className="grow" dir="auto">
                  {stripExt(e.name)}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </Popover>
  );
}

function OutlinePanel() {
  const t = useT();
  const doc = useApp((s) => s.doc);
  const setPanel = useApp((s) => s.setPanel);
  const headings = doc?.headings ?? [];
  const minDepth = Math.min(...headings.map((h) => h.depth), 6);
  const [active] = useState(() => {
    let id = headings[0]?.id;
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el && el.getBoundingClientRect().top < 140) id = h.id;
    }
    return id;
  });
  return (
    <Popover width={320} label={t("outline")}>
      {headings.length === 0 ? <div className="menu-label">{t("noHeadings")}</div> : null}
      {headings.map((h) => (
        <button
          key={h.id}
          className="menu-item"
          data-current={h.id === active}
          style={{ paddingInlineStart: 10 + (h.depth - minDepth) * 14, fontWeight: h.depth === minDepth ? 600 : 400 }}
          onClick={() => {
            setPanel(null);
            scrollToId(h.id);
          }}
        >
          <span className="grow" dir="auto">
            {h.text}
          </span>
        </button>
      ))}
    </Popover>
  );
}

function TypePanel() {
  const t = useT();
  return (
    <Popover width={360} label={t("typography")}>
      <div style={{ padding: "0 6px 8px" }}>
        <TypographyControls compact />
      </div>
    </Popover>
  );
}

export function Panels() {
  const panel = useApp((s) => s.panel);
  const ws = useApp((s) => s.ws);
  return (
    <AnimatePresence>
      {panel === "open" ? <OpenMenu key="open" /> : null}
      {panel === "folder" && ws ? <FolderPanel key="folder" /> : null}
      {panel === "outline" ? <OutlinePanel key="outline" /> : null}
      {panel === "type" ? <TypePanel key="type" /> : null}
    </AnimatePresence>
  );
}
