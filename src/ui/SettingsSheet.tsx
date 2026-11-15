import { motion } from "motion/react";
import { X } from "lucide-react";
import { useApp } from "../state/app";
import { useSettings, type Theme } from "../state/settings";
import { useT } from "../i18n";
import { Segmented, Switch, TypographyControls } from "./controls";
import { platform } from "../platform";
import { spring } from "./motion";
import { Keys, SHORTCUTS } from "./Keys";

const VERSION = "0.1.0";

export function SettingsSheet() {
  const t = useT();
  const s = useSettings();
  const setPanel = useApp((x) => x.setPanel);
  const p = platform();
  const glassCapable = p.isTauri && (p.kind === "mac" || p.kind === "windows");


  return (
    <>
      <motion.div
        className="scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onPointerDown={() => setPanel(null)}
      />
      <motion.div
        className="sheet glass-thick"
        role="dialog"
        aria-modal
        aria-label={t("settings")}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={spring}
      >
        <div className="sheet-head">
          <h2>{t("settings")}</h2>
          <button className="icon-btn" onClick={() => setPanel(null)} aria-label={t("close")}>
            <X />
          </button>
        </div>
        <div className="sheet-body">
          <div className="group">
            <div className="row">
              <span className="label">{t("language")}</span>
              <Segmented
                label={t("language")}
                value={s.lang}
                onChange={(v) => s.set("lang", v)}
                options={[
                  { value: "ar", label: "العربية" },
                  { value: "en", label: "English" },
                ]}
              />
            </div>
            <div className="row">
              <span className="label">{t("appearance")}</span>
              <Segmented<Theme>
                label={t("appearance")}
                value={s.theme}
                onChange={(v) => s.set("theme", v)}
                options={[
                  { value: "system", label: t("themeSystem") },
                  { value: "light", label: t("themeLight") },
                  { value: "dark", label: t("themeDark") },
                ]}
              />
            </div>
            {glassCapable ? (
              <div className="row">
                <span className="label">
                  {t("windowGlass")}
                  <span className="hint">{p.kind === "mac" ? t("windowGlassHint") : "Mica"}</span>
                </span>
                <Switch checked={s.glass} onChange={(v) => s.set("glass", v)} label={t("windowGlass")} />
              </div>
            ) : null}
          </div>

          <TypographyControls />

          <div className="group-title">{t("shortcuts")}</div>
          <div className="group">
            {[...SHORTCUTS, { keys: "mod [", label: "prev" as const }, { keys: "mod ]", label: "next" as const }].map((s) => (
              <div className="row" key={s.keys} style={{ minHeight: 40 }}>
                <span className="label" style={{ fontWeight: 400 }}>
                  {t(s.label)}
                </span>
                <Keys keys={s.keys} small />
              </div>
            ))}
          </div>

          <p className="kbd" style={{ textAlign: "center", marginTop: 18, display: "block" }}>
            {t("about", { v: VERSION })}
          </p>
        </div>
      </motion.div>
    </>
  );
}
