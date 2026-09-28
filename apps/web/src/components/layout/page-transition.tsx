'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/** A short fade-in for page content; disabled automatically for reduced-motion users. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
