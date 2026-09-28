import type { BatteryStatus } from '@bpp/shared/schemas';
import { Badge, type BadgeProps } from '@/components/ui/badge';

const STATUS_TONES: Record<BatteryStatus, BadgeProps['tone']> = {
  Original: 'accent',
  Repurposed: 'info',
  Reused: 'info',
  Remanufactured: 'warning',
  Waste: 'danger',
};

export function StatusBadge({ status }: { status: BatteryStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]} dot>
      {status}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge tone="neutral">{category}</Badge>;
}
