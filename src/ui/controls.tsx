import { useEffect, useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import { springQuick } from "./motion";
import { useSettings, FONT_MAX, FONT_MIN, type Leading, type Measure } from "../state/settings";
import { ARABIC_FONTS, ENGLISH_FONTS, cssFamily, ensureFont, type Role } from "../fonts/registry";
import { useT } from "../i18n";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value ? <motion.span layoutId={`${id}-thumb`} className="thumb" transition={springQuick} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  return (
    <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <motion.span
        className="knob"
        animate={{ x: checked ? (rtl ? -17 : 17) : 0 }}
        transition={springQuick}
      />
    </button>
  );
}

function FontList({ role }: { role: Role }) {
  const t = useT();
  const key = role === "ar" ? "fontAr" : "fontEn";
  const value = useSettings((s) => s[key]);
  const set = useSettings((s) => s.set);
  const list = role === "ar" ? ARABIC_FONTS : ENGLISH_FONTS;
  useEffect(() => {
    list.forEach((f) => void ensureFont(role, f.id));
  }, [list, role]);
  return (
    <div className="group" role="radiogroup" aria-label={t(role === "ar" ? "arabicFont" : "englishFont")}>
      {list.map((f) => (
        <button
          key={f.id}
          className="row"
          role="radio"
          aria-checked={value === f.id}
          onClick={() => set(key, f.id)}
          style={{ minHeight: 44 }}
        >
          <span className="label" style={{ fontFamily: `${cssFamily(role, f.id)}, var(--font-ui)`, fontSize: 15 }} dir={role === "ar" ? "rtl" : "ltr"}>
            {role === "ar" ? `${f.label} — أبجد هوّز حطّي` : `${f.label} — The quick brown fox`}
          </span>
          {value === f.id ? <Check size={16} style={{ color: "var(--accent)" }} /> : null}
        </button>
      ))}
    </div>
  );
}

export function TypographyControls({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const s = useSettings();
  const pct = ((s.fontSize - FONT_MIN) / (FONT_MAX - FONT_MIN)) * 100;
  return (
    <div>
      <div className="group-title" style={compact ? { paddingTop: 6 } : undefined}>
        {t("textSize")}
      </div>
      <div className="group">
        <div className="row">
          <button className="icon-btn" onClick={() => s.bumpFont(-1)} aria-label="−">
            <Minus />
          </button>
          <input
            className="range"
            type="range"
            min={FONT_MIN}
            max={FONT_MAX}
            step={1}
            value={s.fontSize}
            style={{ flex: 1, ["--p" as string]: `${pct}%` }}
            onChange={(e) => s.set("fontSize", Number(e.target.value))}
            aria-label={t("textSize")}
          />
          <button className="icon-btn" onClick={() => s.bumpFont(1)} aria-label="+">
            <Plus />
          </button>
        </div>
        <div className="row">
          <span className="label">{t("lineWidth")}</span>
          <Segmented<Measure>
            label={t("lineWidth")}
            value={s.measure}
            onChange={(v) => s.set("measure", v)}
            options={[
              { value: "narrow", label: t("narrow") },
              { value: "normal", label: t("normal") },
              { value: "wide", label: t("wide") },
            ]}
          />
        </div>
        <div className="row">
          <span className="label">{t("lineSpacing")}</span>
          <Segmented<Leading>
            label={t("lineSpacing")}
            value={s.leading}
            onChange={(v) => s.set("leading", v)}
            options={[
              { value: "compact", label: t("compact") },
              { value: "normal", label: t("normal") },
              { value: "relaxed", label: t("relaxed") },
            ]}
          />
        </div>
      </div>
      <div className="group-title">{t("arabicFont")}</div>
      <FontList role="ar" />
      <div className="group-title">{t("englishFont")}</div>
      <FontList role="en" />
    </div>
  );
}
