import type { BatteryStatus } from '@bpp/shared/schemas';
import { Badge, type BadgeProps } from '@/components/ui/badge';

const STATUS_TONES: Record<BatteryStatus, BadgeProps['tone']> = {
  Original: 'accent',
  Repurposed: 'info',
  Reused: 'info',
  Remanufactured: 'warning',
  Waste: 'danger',
};

export function StatusBadge({ status, className }: { status: BatteryStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status]} dot className={className}>
      {status}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge tone="neutral">{category}</Badge>;
}
