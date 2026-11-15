import { motion } from "motion/react";
import { FileText, FolderOpen, Folder, Globe, FileDown, Clock, Keyboard } from "lucide-react";
import { useT } from "../i18n";
import { useSettings } from "../state/settings";
import { openFile, openFolder, openRecent } from "../actions";
import { useRecents } from "./Panels";
import { platform } from "../platform";
import type { RecentItem } from "../platform/types";
import { stripExt } from "../lib/path";
import { spring } from "./motion";
import { UrlField } from "./UrlField";
import { Keys, SHORTCUTS } from "./Keys";

export function AppMark({ size = 84 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id="qari-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#64d2ff" />
          <stop offset="0.5" stopColor="#0a84ff" />
          <stop offset="1" stopColor="#5e5ce6" />
        </linearGradient>
        <linearGradient id="qari-s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="qari-p" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.97" />
          <stop offset="1" stopColor="#eef4ff" stopOpacity="0.92" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="22" fill="url(#qari-g)" />
      <rect x="2" y="2" width="96" height="96" rx="22" fill="url(#qari-s)" opacity="0.6" />
      <rect x="25" y="19" width="50" height="62" rx="8" fill="url(#qari-p)" />
      <text x="50" y="58" textAnchor="middle" fontSize="34" fontWeight="800" fill="#0a64e0" style={{ fontFamily: "var(--font-ui)" }}>
        ق
      </text>
      <rect x="35" y="66" width="30" height="3" rx="1.5" fill="#0a84ff" opacity="0.3" />
    </svg>
  );
}

function relTime(at: number, lang: string) {
  const diff = (at - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
  const steps: [number, number, Intl.RelativeTimeFormatUnit][] = [
    [60, 1, "second"],
    [3600, 60, "minute"],
    [86400, 3600, "hour"],
    [604800, 86400, "day"],
    [2629800, 604800, "week"],
    [31557600, 2629800, "month"],
  ];
  for (const [limit, div, unit] of steps) {
    if (Math.abs(diff) < limit) return rtf.format(Math.round(diff / div), unit);
  }
  return rtf.format(Math.round(diff / 31557600), "year");
}

function recentIcon(r: RecentItem) {
  if (r.url) return { icon: <Globe size={17} />, tint: "var(--important)" };
  if (r.kind === "folder") return { icon: <Folder size={17} />, tint: "var(--accent)" };
  return { icon: <FileText size={17} />, tint: "var(--tip)" };
}

function prettySource(r: RecentItem) {
  if (r.url) return r.url.replace(/^https?:\/\/(www\.)?/, "");
  if (r.path) return r.path.replace(/^\/Users\/[^/]+/, "~").replace(/^C:\\Users\\[^\\]+/i, "~");
  return null;
}

const rise = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { ...spring, delay: 0.035 * i },
});

export function EmptyState() {
  const t = useT();
  const lang = useSettings((s) => s.lang);
  const [recents, setRecents] = useRecents();
  const p = platform();

  const actions = [
    { icon: <FileText size={20} />, title: t("openFile"), hint: t("openFileHint"), keys: "mod O", onClick: openFile },
    { icon: <FolderOpen size={20} />, title: t("openFolder"), hint: t("openFolderHint"), keys: "mod shift O", onClick: openFolder },
  ];

  return (
    <motion.div className="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="ambient" aria-hidden />
      <div className="home-inner">
        <header className="hero">
          <motion.div
            initial={{ scale: 0.82, opacity: 0, filter: "blur(10px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ ...spring, duration: 0.5 }}
            className="hero-mark"
          >
            <AppMark size={92} />
          </motion.div>
          <motion.h1 {...rise(1)}>{t("helloHero")}</motion.h1>
          <motion.p {...rise(2)}>{t("heroSub")}</motion.p>
        </header>

        <motion.div {...rise(3)} className="w-full">
          <UrlField big />
        </motion.div>

        <div className="action-grid">
          {actions.map((a, i) => (
            <motion.button key={i} className="action glass" {...rise(4 + i)} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => void a.onClick()}>
              <span className="action-icon">{a.icon}</span>
              <span className="action-title">{a.title}</span>
              <span className="action-hint">{a.hint}</span>
              <span className="action-keys">
                <Keys keys={a.keys} small />
              </span>
            </motion.button>
          ))}
          <motion.div className="action action-drop" {...rise(6)}>
            <span className="action-icon">
              <FileDown size={20} />
            </span>
            <span className="action-title">{t("dropTitle")}</span>
            <span className="action-hint">{t("dropHint")}</span>
          </motion.div>
        </div>

        <div className="info-grid">
          <motion.section className="panel glass" {...rise(7)}>
            <div className="panel-head">
              <span>
                <Clock size={14} />
                {t("recent")}
              </span>
              {recents.length ? (
                <button
                  className="panel-link"
                  onClick={async () => {
                    await p.forgetRecents();
                    const { clearUrlRecents } = await import("../platform/recents");
                    clearUrlRecents();
                    setRecents([]);
                  }}
                >
                  {t("clearRecent")}
                </button>
              ) : null}
            </div>
            {recents.length ? (
              <div className="recent-list">
                {recents.slice(0, 6).map((r) => {
                  const { icon, tint } = recentIcon(r);
                  const src = prettySource(r);
                  return (
                    <button key={r.key + r.at} className="recent-row" onClick={() => void openRecent(r)} title={r.url ?? r.path ?? r.name}>
                      <span className="recent-icon" style={{ color: tint, background: `color-mix(in srgb, ${tint} 14%, transparent)` }}>
                        {icon}
                      </span>
                      <span className="recent-text">
                        <span className="recent-name" dir="auto">
                          {r.kind === "file" ? stripExt(r.name) : r.name}
                        </span>
                        {src ? (
                          <span className="recent-src" dir="ltr">
                            {src}
                          </span>
                        ) : null}
                      </span>
                      <span className="recent-time">{relTime(r.at, lang)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="panel-empty">
                <Clock size={22} />
                <span>{p.persistentRecents ? t("noRecent") : t("limitedBrowser")}</span>
              </div>
            )}
          </motion.section>

          <motion.section className="panel glass" {...rise(8)}>
            <div className="panel-head">
              <span>
                <Keyboard size={14} />
                {t("shortcuts")}
              </span>
            </div>
            <div className="shortcut-list">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="shortcut-row">
                  <span>{t(s.label)}</span>
                  <Keys keys={s.keys} small />
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}
