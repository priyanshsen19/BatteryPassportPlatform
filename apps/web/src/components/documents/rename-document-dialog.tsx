'use client';

import type { DocumentDto } from '@bpp/shared/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose } from '@/components/ui/dialog';
import { Field, Input, fieldAria } from '@/components/ui/form-controls';
import { ApiError } from '@/lib/api-client';
import { useUpdateDocument } from '@/lib/queries';

const schema = z.object({ fileName: z.string().trim().min(1, 'File name is required').max(255) });
type FormValues = z.infer<typeof schema>;

interface RenameDocumentDialogProps {
  document: DocumentDto | null;
  onOpenChange: (open: boolean) => void;
}

export function RenameDocumentDialog({ document, onOpenChange }: RenameDocumentDialogProps) {
  const update = useUpdateDocument();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (document) reset({ fileName: document.fileName });
  }, [document, reset]);

  const onSubmit = ({ fileName }: FormValues) => {
    if (!document) return;
    update.mutate(
      { docId: document.docId, changes: { fileName } },
      {
        onSuccess: () => {
          toast.success('Document renamed', { description: fileName });
          onOpenChange(false);
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : 'Could not update the document'),
      },
    );
  };

  const error = errors.fileName?.message;

  return (
    <Dialog
      open={document !== null}
      onOpenChange={onOpenChange}
      title="Rename document"
      description="Only the display name changes; the stored file is not modified."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <Field id="document-file-name" label="File name" error={error}>
          <Input invalid={!!error} {...fieldAria('document-file-name', error)} {...register('fileName')} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="secondary" type="button">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" loading={update.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
