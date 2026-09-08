import { useEffect, useRef } from "react";

type JobPollingOptions<T> = {
  enabled: boolean;
  intervalMs: number;
  poll: () => Promise<T>;
  onSuccess: (value: T) => void;
  onError?: (error: unknown) => void;
  maxBackoffMs?: number;
  immediate?: boolean;
  pollKey?: string | number;
  deadlineMs?: number;
  onDeadline?: () => void;
};

/** Polls active background jobs without polling hidden tabs or overlapping work. */
export function useJobPolling<T>({ enabled, intervalMs, poll, onSuccess, onError, maxBackoffMs = 30_000, immediate = false, pollKey = "default", deadlineMs, onDeadline }: JobPollingOptions<T>) {
  const options = useRef({ enabled, intervalMs, poll, onSuccess, onError, maxBackoffMs, deadlineMs, onDeadline });
  options.current = { enabled, intervalMs, poll, onSuccess, onError, maxBackoffMs, deadlineMs, onDeadline };

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    let timer: number | undefined;
    let failures = 0;
    const startedAt = Date.now();
    let deadlineReached = false;
    const expired = () => {
      if (!options.current.deadlineMs || Date.now() - startedAt < options.current.deadlineMs) return false;
      if (!deadlineReached) options.current.onDeadline?.();
      deadlineReached = true;
      clear();
      return true;
    };
    // If focus returns while a visible request is still completing, run one
    // fresh request immediately after it settles rather than losing that resume.
    let refreshOnVisible = false;
    const clear = () => { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; };
    const schedule = (delay: number) => {
      clear();
      if (!disposed && options.current.enabled && !document.hidden && !expired()) timer = window.setTimeout(run, delay);
    };
    const run = async () => {
      if (disposed || inFlight || document.hidden || !options.current.enabled || expired()) return;
      inFlight = true;
      let nextDelay = options.current.intervalMs;
      try {
        const value = await options.current.poll();
        if (!disposed) options.current.onSuccess(value);
        failures = 0;
      } catch (error) {
        if (!disposed) options.current.onError?.(error);
        failures += 1;
        nextDelay = Math.min(options.current.intervalMs * 2 ** failures, options.current.maxBackoffMs);
      } finally {
        inFlight = false;
        if (disposed || !options.current.enabled || document.hidden) return;
        if (refreshOnVisible) {
          refreshOnVisible = false;
          void run();
        } else schedule(nextDelay);
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) clear();
      else if (options.current.enabled) {
        clear();
        if (inFlight) refreshOnVisible = true;
        else void run();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (immediate && enabled && !document.hidden) void run();
    else schedule(intervalMs);
    return () => { disposed = true; clear(); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, [enabled, intervalMs, immediate, pollKey]);
}
