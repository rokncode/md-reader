import { motion } from "motion/react";
import { Plus, ChevronDown, ListTree, ALargeSmall, Search, Settings2, Folder, FileText, Share } from "lucide-react";
import { currentShareLink } from "../lib/share";
import { useApp } from "../state/app";
import { useT } from "../i18n";
import { stripExt } from "../lib/path";
import { run } from "../actions";
import { spring } from "./motion";
import { WinCaption } from "./WinCaption";
import { platform } from "../platform";

export function Toolbar() {
  const t = useT();
  const ws = useApp((s) => s.ws);
  const doc = useApp((s) => s.doc);
  const panel = useApp((s) => s.panel);
  const hidden = useApp((s) => (s.chromeHidden && !s.panel) || s.focus);
  const scrolled = useApp((s) => s.scrolled);
  const togglePanel = useApp((s) => s.togglePanel);
  const isWin = platform().kind === "windows" && platform().isTauri;

  const share = async () => {
    const link = currentShareLink();
    if (!link) return;
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (coarse && navigator.share) {
      await navigator.share({ title: doc ? stripExt(doc.name) : undefined, url: link }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      useApp.getState().notify(t("linkCopied"));
    } catch {
      /* clipboard denied */
    }
  };

  const open = (p: "open" | "folder" | "outline" | "type") => (e: React.MouseEvent) => togglePanel(p, e.currentTarget);

  const entry = ws && doc ? ws.entries.find((e) => e.rel === doc.rel) : null;
  // Only the nearest folder — the file name is what matters and must never be squeezed out.
  const folderLabel = ws?.kind === "folder" ? (entry?.dir ? entry.dir.split("/").pop()! : ws.name) : null;

  const chrome = {
    animate: hidden ? { y: -14, opacity: 0, filter: "blur(4px)" } : { y: 0, opacity: 1, filter: "blur(0px)" },
    transition: spring,
    style: { pointerEvents: hidden ? ("none" as const) : ("auto" as const) },
  };

  return (
    <header className="titlebar" data-tauri-drag-region data-scrolled={scrolled} data-hidden={hidden}>
      <motion.div className="tb-side tb-start" data-tauri-drag-region {...chrome}>
        <div className="pill glass">
          <button
            className="icon-btn"
            aria-label={t("open")}
            title={t("open")}
            aria-expanded={panel === "open"}
            data-panel-trigger
            onClick={open("open")}
          >
            <Plus />
          </button>
        </div>
      </motion.div>

      <motion.div className="tb-center" data-tauri-drag-region {...chrome}>
        {doc ? (
          <button
            className="crumb glass"
            data-panel-trigger
            aria-expanded={panel === "folder"}
            onClick={ws && ws.entries.length > 1 ? open("folder") : open("outline")}
            title={doc.rel}
          >
            {folderLabel ? (
              <>
                <Folder size={14} className="folder" />
                <span className="folder name" style={{ maxWidth: "14ch", flexShrink: 2 }}>
                  {folderLabel}
                </span>
                <span className="sep inline-block rtl:-scale-x-100">›</span>
              </>
            ) : (
              <FileText size={14} className="folder" />
            )}
            <span className="name" dir="auto" style={{ flexShrink: 1, minWidth: "6ch" }}>
              {stripExt(doc.name)}
            </span>
            <ChevronDown size={14} className="folder" />
          </button>
        ) : null}
      </motion.div>

      <motion.div className="tb-side tb-end" data-tauri-drag-region {...chrome}>
        {doc ? (
          <div className="pill glass">
            <button
              className="icon-btn"
              data-trigger="outline"
              data-panel-trigger
              aria-label={t("outline")}
              title={t("outline")}
              aria-expanded={panel === "outline"}
              onClick={open("outline")}
            >
              <ListTree />
            </button>
            <button
              className="icon-btn"
              data-panel-trigger
              aria-label={t("typography")}
              title={t("typography")}
              aria-expanded={panel === "type"}
              onClick={open("type")}
            >
              <ALargeSmall />
            </button>
            <button className="icon-btn" aria-label={t("find")} title={t("find")} onClick={() => run("find")}>
              <Search />
            </button>
            {ws?.share ? (
              <button className="icon-btn" aria-label={t("share")} title={t("share")} onClick={() => void share()}>
                <Share />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="pill glass">
          <button className="icon-btn" aria-label={t("settings")} title={t("settings")} onClick={() => run("settings")}>
            <Settings2 />
          </button>
        </div>
      </motion.div>

      {isWin ? <WinCaption /> : null}
    </header>
  );
}
