import type { Role } from '@bpp/shared/schemas';
import { Badge, type BadgeProps } from '@/components/ui/badge';

const ROLE_TONES: Record<Role, BadgeProps['tone']> = {
  admin: 'accent',
  developer: 'info',
  tester: 'warning',
  user: 'neutral',
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  developer: 'Developer',
  tester: 'Tester',
  user: 'User',
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={ROLE_TONES[role]}>{ROLE_LABELS[role]}</Badge>;
}
