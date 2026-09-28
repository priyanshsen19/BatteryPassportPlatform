'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { formatNumber } from '@/lib/utils';

/** Counts up to `value`; renders the final value immediately for reduced-motion users. */
export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (reduceMotion) {
      node.textContent = formatNumber(value);
      previous.current = value;
      return undefined;
    }
    const controls = animate(previous.current, value, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (latest) => {
        node.textContent = formatNumber(Math.round(latest));
      },
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, reduceMotion]);

  return (
    <span ref={ref} aria-label={formatNumber(value)}>
      {formatNumber(reduceMotion ? value : previous.current)}
    </span>
  );
}
