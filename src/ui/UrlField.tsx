import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link2, ArrowUp, Loader2 } from "lucide-react";
import { useT, type Key } from "../i18n";
import { openUrl } from "../actions";
import { useApp } from "../state/app";
import { materialize, spring } from "./motion";

/** One field for any Markdown URL or GitHub repo/folder/file. */
export function UrlField({ autoFocus = false, big = false, onOpened }: { autoFocus?: boolean; big?: boolean; onOpened?: () => void }) {
  const t = useT();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Key | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => void (alive.current = false);
  }, []);

  const submit = async () => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    const err = await openUrl(value);
    // The loading view may have replaced this field (empty state) — fall back to a toast.
    if (!alive.current) {
      if (err) useApp.getState().notify(t(err));
      return;
    }
    setBusy(false);
    if (err) setError(err);
    else {
      setValue("");
      onOpened?.();
    }
  };

  const h = big ? 54 : 48;
  return (
    <div className="w-full">
      <form
        className={`urlfield ${big ? "glass" : ""}`}
        style={{ height: h }}
        data-error={!!error}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Link2 size={big ? 19 : 18} className="shrink-0" style={{ color: "var(--text-3)" }} />
        <input
          autoFocus={autoFocus}
          value={value}
          dir="ltr"
          inputMode="url"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={t("urlPlaceholder")}
          aria-label={t("openUrl")}
        />
        <motion.button
          type="submit"
          className="urlgo"
          disabled={!value.trim() || busy}
          whileTap={{ scale: 0.9 }}
          aria-label={t("open")}
          title={t("open")}
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <ArrowUp size={17} strokeWidth={2.4} />}
        </motion.button>
      </form>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="err"
            className="urlhint"
            style={{ color: "var(--caution)" }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {t(error)}
          </motion.p>
        ) : (
          <motion.p key="hint" className="urlhint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {busy ? t("opening") : t("urlExamples")}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** ⌘L — a Spotlight-style sheet that drops from the top. */
export function UrlSheet() {
  const t = useT();
  const setPanel = useApp((s) => s.setPanel);
  return (
    <>
      <div className="fixed inset-0 z-[69]" onPointerDown={() => setPanel(null)} />
      <motion.div
        className="glass-thick fixed z-[70] inset-x-0 mx-auto"
        style={{ top: "13vh", width: "min(600px, calc(100vw - 32px))", borderRadius: "var(--r-xl)", padding: "14px 14px 4px", transformOrigin: "50% 0" }}
        {...materialize}
        transition={spring}
        role="dialog"
        aria-label={t("openUrl")}
      >
        <div className="menu-label" style={{ paddingTop: 0 }}>
          {t("openUrl")}
        </div>
        <UrlField autoFocus onOpened={() => setPanel(null)} />
      </motion.div>
    </>
  );
}
