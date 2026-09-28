'use client';

import type { PassportDto } from '@bpp/shared/schemas';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-client';
import { useDeletePassport } from '@/lib/queries';

interface DeletePassportDialogProps {
  passport: PassportDto | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeletePassportDialog({ passport, onOpenChange, onDeleted }: DeletePassportDialogProps) {
  const deletePassport = useDeletePassport();
  const identifier = passport?.data.generalInformation.batteryIdentifier;

  const confirm = () => {
    if (!passport) return;
    deletePassport.mutate(passport.id, {
      onSuccess: () => {
        toast.success('Passport deleted', { description: identifier });
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete the passport'),
    });
  };

  return (
    <ConfirmDialog
      open={passport !== null}
      onOpenChange={onOpenChange}
      title="Delete battery passport?"
      description={
        <>
          <span className="font-mono text-ink">{identifier}</span> will be permanently removed. Documents
          linked to it are kept and can be deleted separately.
        </>
      }
      confirmLabel="Delete passport"
      onConfirm={confirm}
      pending={deletePassport.isPending}
    />
  );
}
