import type { Transition } from "motion/react";

/** Critically damped — the default for anything that just appears. */
export const spring: Transition = { type: "spring", bounce: 0, duration: 0.34 };
/** Snappier response for small controls (segmented thumb, switch knob). */
export const springQuick: Transition = { type: "spring", bounce: 0, duration: 0.26 };
/** A touch of bounce — only after a gesture that carried momentum. */
export const springMomentum: Transition = { type: "spring", bounce: 0.18, duration: 0.42 };

/** Glass materializes: blur + scale + opacity together, never a plain fade. */
export const materialize = {
  initial: { opacity: 0, scale: 0.92, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.94, filter: "blur(6px)" },
};
