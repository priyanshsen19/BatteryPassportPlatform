import Image from 'next/image';
import { cn } from '@/lib/utils';

const WIDTH = 320;
const HEIGHT = 73;

interface LogoProps {
  /** `auto` follows the colour theme; `on-dark` is for permanently dark surfaces like the sidebar. */
  tone?: 'auto' | 'on-dark';
  className?: string;
  priority?: boolean;
}

export function Logo({ tone = 'auto', className, priority }: LogoProps) {
  // Small static PNGs: served as-is, so the standalone server needs no image optimiser.
  const common = { width: WIDTH, height: HEIGHT, priority, alt: 'MEAtec', unoptimized: true };

  if (tone === 'on-dark') {
    return <Image src="/meatec-logo-light.png" {...common} className={cn('h-7 w-auto', className)} />;
  }

  return (
    <>
      <Image src="/meatec-logo.png" {...common} className={cn('h-7 w-auto dark:hidden', className)} />
      <Image
        src="/meatec-logo-light.png"
        {...common}
        className={cn('hidden h-7 w-auto dark:block', className)}
      />
    </>
  );
}
