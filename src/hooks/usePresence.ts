import { useEffect, useState } from "react";

type PresencePhase = "entering" | "entered" | "exiting";

export type Presence = {
  mounted: boolean;
  phase: PresencePhase;
};

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Keeps a small UI surface mounted until its CSS exit transition finishes. */
export default function usePresence(open: boolean, exitMs = 180): Presence {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<PresencePhase>(open ? "entered" : "exiting");

  useEffect(() => {
    let frame = 0;
    let timer: number | undefined;

    if (open) {
      setMounted(true);
      setPhase("entering");
      frame = window.requestAnimationFrame(() => setPhase("entered"));
    } else if (mounted) {
      setPhase("exiting");
      if (reducedMotion()) {
        setMounted(false);
      } else {
        timer = window.setTimeout(() => setMounted(false), exitMs);
      }
    }

    return () => {
      window.cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [exitMs, mounted, open]);

  return { mounted, phase };
}
