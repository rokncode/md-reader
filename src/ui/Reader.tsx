import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp, scrollMemory } from "../state/app";
import { Content, scrollToId } from "../markdown/Content";
import { EmptyState } from "./EmptyState";
import { useT } from "../i18n";
import { Loader2 } from "lucide-react";

/** The full-window reading canvas. The chrome floats above; content scrolls underneath. */
export function Reader() {
  const t = useT();
  const doc = useApp((s) => s.doc);
  const error = useApp((s) => s.error);
  const loading = useApp((s) => s.loading);
  const opening = useApp((s) => s.opening);
  const pendingHash = useApp((s) => s.pendingHash);
  const set = useApp((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ y: 0, rel: "" });
  const [flash, setFlash] = useState(false);

  // Restore position per document; jump to #hash when a link asked for one.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !doc) return;
    if (last.current.rel !== doc.rel) {
      if (last.current.rel) scrollMemory.set(last.current.rel, el.scrollTop);
      el.scrollTop = scrollMemory.get(doc.rel) ?? 0;
      last.current = { y: el.scrollTop, rel: doc.rel };
      set({ chromeHidden: false, scrolled: el.scrollTop > 4 });
    }
  }, [doc?.rel, set, doc]);

  useEffect(() => {
    if (pendingHash && doc) {
      requestAnimationFrame(() => scrollToId(pendingHash, false));
      set({ pendingHash: null });
    }
  }, [pendingHash, doc, set]);

  // Subtle refresh cue when the file changes on disk.
  useEffect(() => {
    if (!doc?.version) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 320);
    return () => clearTimeout(id);
  }, [doc?.version]);

  const onScroll = () => {
    const el = ref.current!;
    const y = el.scrollTop;
    const dy = y - last.current.y;
    last.current.y = y;
    const st = useApp.getState();
    const scrolled = y > 4;
    let hidden = st.chromeHidden;
    if (dy > 6 && y > 140) hidden = true;
    else if (dy < -6 || y < 60) hidden = false;
    if (scrolled !== st.scrolled || hidden !== st.chromeHidden) set({ scrolled, chromeHidden: hidden });
  };

  return (
    <div ref={ref} className="scroller" onScroll={doc ? onScroll : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        {doc ? (
          <motion.article
            key={doc.rel}
            className="prose"
            lang={doc.lang}
            dir={doc.lang === "ar" ? "rtl" : "ltr"}
            data-refreshed={flash}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Content tree={doc.tree} rel={doc.rel} docLang={doc.lang} />
          </motion.article>
        ) : loading ? (
          <motion.div
            key="loading"
            className="loading-view"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, delay: 0.08 }}
          >
            <Loader2 size={22} className="animate-spin" />
            <p className="loading-title">{t("opening")}</p>
            {opening ? (
              <p className="loading-target" dir="ltr">
                {opening}
              </p>
            ) : null}
            <div className="doc-skeleton" aria-hidden>
              <span style={{ width: "55%", height: 22 }} />
              <span />
              <span />
              <span style={{ width: "80%" }} />
              <span style={{ width: "40%", marginTop: 18 }} />
              <span />
              <span style={{ width: "70%" }} />
            </div>
          </motion.div>
        ) : error ? (
          <motion.div key="err" className="grid place-items-center h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-center" style={{ color: "var(--text-2)" }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{t(error as "errorRead")}</p>
            </div>
          </motion.div>
        ) : (
          <EmptyState key="empty" />
        )}
      </AnimatePresence>
    </div>
  );
}
