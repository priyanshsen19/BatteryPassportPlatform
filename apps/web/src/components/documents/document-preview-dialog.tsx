'use client';

import { PREVIEWABLE_MIME_TYPES, type DocumentDto } from '@bpp/shared/schemas';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Download, ExternalLink, FileText, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { overlayClass } from '@/components/ui/dialog';
import { ErrorState, Skeleton } from '@/components/ui/surface';
import { ApiError } from '@/lib/api-client';
import { downloadDocument, useDocumentLink } from '@/lib/queries';
import { formatBytes, formatDate, mimeLabel } from '@/lib/utils';

const previewable: ReadonlySet<string> = new Set(PREVIEWABLE_MIME_TYPES);

export function canPreview(doc: DocumentDto): boolean {
  return previewable.has(doc.mimeType);
}

function PreviewBody({ doc }: { doc: DocumentDto }) {
  const link = useDocumentLink(doc.docId, 'inline');
  const [imageLoaded, setImageLoaded] = useState(false);

  if (link.isLoading) return <Skeleton className="h-full w-full rounded-none" />;
  if (link.isError || !link.data) {
    return (
      <ErrorState
        title="Preview unavailable"
        message={link.error instanceof ApiError ? link.error.message : 'The preview could not be loaded.'}
        onRetry={() => link.refetch()}
      />
    );
  }

  if (doc.mimeType === 'application/pdf') {
    return (
      <iframe
        src={link.data.downloadUrl}
        title={`Preview of ${doc.fileName}`}
        className="h-full w-full bg-white"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center overflow-auto p-6">
      {!imageLoaded && <Skeleton className="absolute h-2/3 w-2/3" />}
      {/* Pre-signed URLs are one-off and short-lived, so next/image optimisation does not apply. */}
      <img
        src={link.data.downloadUrl}
        alt={doc.fileName}
        onLoad={() => setImageLoaded(true)}
        className="max-h-full max-w-full rounded-md object-contain shadow-raised"
      />
    </div>
  );
}

interface DocumentPreviewDialogProps {
  document: DocumentDto | null;
  onOpenChange: (open: boolean) => void;
}

/** Full-size in-app preview for PDFs and images, served through a short-lived inline S3 link. */
export function DocumentPreviewDialog({ document: doc, onOpenChange }: DocumentPreviewDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const inlineLink = useDocumentLink(doc?.docId ?? null, 'inline');

  const download = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      await downloadDocument(doc.docId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a download link');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <DialogPrimitive.Root open={doc !== null} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-overlay focus:outline-none sm:inset-8 lg:inset-x-[max(2rem,calc(50vw-36rem))]">
          {doc && (
            <>
              <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                <FileText className="size-5 shrink-0 text-ink-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <DialogPrimitive.Title className="truncate text-sm font-semibold text-ink">
                    {doc.fileName}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-xs text-ink-subtle">
                    {mimeLabel(doc.mimeType)} · {formatBytes(doc.size)} · uploaded {formatDate(doc.createdAt)}
                  </DialogPrimitive.Description>
                </div>
                <Badge tone="accent" className="hidden sm:inline-flex">
                  Link expires in {Math.round((inlineLink.data?.expiresIn ?? 300) / 60)} min
                </Badge>
                <div className="flex items-center gap-1">
                  {inlineLink.data && (
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a
                        href={inlineLink.data.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open in new tab"
                        title="Open in new tab"
                      >
                        <ExternalLink />
                      </a>
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={download} loading={downloading}>
                    {!downloading && <Download />}
                    Download
                  </Button>
                  <DialogPrimitive.Close asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Close preview">
                      <X />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
              </header>
              <div className="relative min-h-0 flex-1 bg-subtle">
                <PreviewBody doc={doc} />
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
