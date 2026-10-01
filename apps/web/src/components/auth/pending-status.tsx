'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export interface PendingStep {
  /** Seconds after the request starts when this line appears. */
  after: number;
  text: string;
}

/** Seconds since `active` became true; 0 while inactive. */
function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [active]);
  return elapsed;
}

/**
 * The status line for a long-running request: the latest step whose time has come. The backend
 * services can take up to a minute to start after a quiet period, so a single static label would
 * look stuck.
 */
export function usePendingMessage(active: boolean, steps: PendingStep[]): string | undefined {
  const elapsed = useElapsedSeconds(active);
  if (!active) return undefined;
  return [...steps].reverse().find((step) => elapsed >= step.after)?.text ?? steps[0]?.text;
}

/** Shown under a submit button once a request has been running for a while. */
export function SlowStartNote({ active, afterSeconds = 8 }: { active: boolean; afterSeconds?: number }) {
  const elapsed = useElapsedSeconds(active);
  return (
    <AnimatePresence>
      {active && elapsed >= afterSeconds && (
        <motion.p
          role="status"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="-mt-1 text-center text-xs text-ink-subtle"
        >
          The first request after a quiet period can take up to a minute while the servers start.
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** Button label that fades between steps. */
export function PendingLabel({ text }: { text: string }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={text}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.18 }}
        aria-live="polite"
      >
        {text}
      </motion.span>
    </AnimatePresence>
  );
}
