import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { useApp } from "../state/app";
import { materialize, spring } from "./motion";

/**
 * A glass popover that grows out of the control that opened it and returns
 * along the same path. Positioned under the trigger, clamped to the window.
 */
export function Popover({ width, children, label }: { width: number; children: ReactNode; label: string }) {
  const anchor = useApp((s) => s.anchor);
  const setPanel = useApp((s) => s.setPanel);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || t.closest("[data-panel-trigger]")) return;
      setPanel(null);
    };
    const onResize = () => setPanel(null);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onResize);
    };
  }, [setPanel]);

  const vw = window.innerWidth;
  const w = Math.min(width, vw - 24);
  const cx = anchor ? anchor.left + anchor.width / 2 : vw / 2;
  const left = Math.max(12, Math.min(cx - w / 2, vw - w - 12));
  const top = anchor ? anchor.bottom + 8 : 64;
  const originX = Math.max(16, Math.min(cx - left, w - 16));

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={label}
      className="popover glass-thick"
      style={{ left, top, width: w, transformOrigin: `${originX}px 0px` }}
      {...materialize}
      transition={spring}
    >
      {children}
    </motion.div>
  );
}
