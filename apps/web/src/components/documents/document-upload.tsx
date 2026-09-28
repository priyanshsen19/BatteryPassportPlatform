'use client';

import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from '@bpp/shared/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { FileUp, UploadCloud, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { uploadDocument } from '@/lib/upload';
import { cn, formatBytes } from '@/lib/utils';

const ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');
const allowedTypes: ReadonlySet<string> = new Set(ALLOWED_DOCUMENT_MIME_TYPES);

function validateFile(file: File): string | undefined {
  if (!allowedTypes.has(file.type))
    return 'This file type is not supported. Use PDF, image, text, CSV, JSON, Word or Excel.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_DOCUMENT_SIZE_BYTES)
    return `Files must be ${formatBytes(MAX_DOCUMENT_SIZE_BYTES)} or smaller.`;
  return undefined;
}

interface DocumentUploadProps {
  passportId?: string;
  onUploaded?: () => void;
}

/** Select or drop a file → validate → upload with progress → refresh the list. */
export function DocumentUpload({ passportId, onUploaded }: DocumentUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploading = progress !== null;

  const choose = (selected: File | undefined) => {
    if (!selected) return;
    setError(validateFile(selected));
    setFile(selected);
  };

  const reset = () => {
    setFile(null);
    setError(undefined);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!uploading) choose(event.dataTransfer.files[0]);
  };

  const upload = async () => {
    if (!file || error) return;
    abortRef.current = new AbortController();
    setProgress(0);
    try {
      const result = await uploadDocument(file, passportId, setProgress, abortRef.current.signal);
      await queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded', { description: result.fileName });
      reset();
      onUploaded?.();
    } catch (err) {
      setProgress(null);
      if (err instanceof ApiError && err.code === 'ABORTED') return;
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-center transition-colors',
          dragging
            ? 'border-accent bg-accent-soft'
            : 'border-line-strong hover:border-ink-subtle hover:bg-subtle/60',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <UploadCloud className="mb-2 size-5 text-ink-subtle" aria-hidden />
        <span className="text-[13px] font-medium text-ink">
          Drop a file here or <span className="text-accent underline underline-offset-4">browse</span>
        </span>
        <span className="mt-1 text-xs text-ink-subtle">
          PDF, images, text, CSV, JSON, Word or Excel · up to {formatBytes(MAX_DOCUMENT_SIZE_BYTES)}
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={uploading}
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </label>

      <AnimatePresence initial={false}>
        {file && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="rounded-md border border-line bg-surface p-3">
              <div className="flex items-center gap-3">
                <FileUp className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{file.name}</p>
                  <p className="text-xs text-ink-subtle">{formatBytes(file.size)}</p>
                </div>
                {uploading ? (
                  <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
                    Cancel
                  </Button>
                ) : (
                  <>
                    <Button size="sm" onClick={upload} disabled={!!error}>
                      Upload
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="Remove selected file">
                      <X />
                    </Button>
                  </>
                )}
              </div>

              {uploading && (
                <div className="mt-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-line"
                    role="progressbar"
                    aria-label={`Uploading ${file.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ ease: 'linear', duration: 0.1 }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted tabular-nums" aria-live="polite">
                    {progress < 100 ? `Uploading… ${progress}%` : 'Processing…'}
                  </p>
                </div>
              )}

              {error && (
                <p className="mt-2 text-xs text-danger" role="alert">
                  {error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
