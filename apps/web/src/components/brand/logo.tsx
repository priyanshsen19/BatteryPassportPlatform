import { BatteryCharging } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: { mark: 'size-6 rounded-md [&_svg]:size-3.5', text: 'text-base' },
  md: { mark: 'size-7 rounded-lg [&_svg]:size-4', text: 'text-lg' },
  lg: { mark: 'size-9 rounded-lg [&_svg]:size-5', text: 'text-2xl' },
} as const;

interface LogoProps {
  /** `auto` follows the colour theme; `on-dark` is for permanently dark surfaces like the sidebar. */
  tone?: 'auto' | 'on-dark';
  size?: keyof typeof SIZES;
  className?: string;
}

/** BatteryPass wordmark: teal mark and "Battery", with "Pass" in the ink colour of the surface. */
export function Logo({ tone = 'auto', size = 'md', className }: LogoProps) {
  const { mark, text } = SIZES[size];

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('flex shrink-0 items-center justify-center bg-brand text-white', mark)} aria-hidden>
        <BatteryCharging strokeWidth={2.25} />
      </span>
      <span className={cn('leading-none font-semibold tracking-tight', text)}>
        <span className="text-brand">Battery</span>
        <span className={tone === 'on-dark' ? 'text-sidebar-ink' : 'text-ink'}>Pass</span>
      </span>
    </span>
  );
}
