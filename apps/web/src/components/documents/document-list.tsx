'use client';

import type { DocumentDto } from '@bpp/shared/schemas';
import { Download, FileText, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/surface';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { downloadDocument, useDeleteDocument } from '@/lib/queries';
import { formatBytes, formatDate, mimeLabel } from '@/lib/utils';
import { RenameDocumentDialog } from './rename-document-dialog';

interface DocumentListProps {
  documents: DocumentDto[];
  isAdmin: boolean;
  showPassport?: boolean;
}

export function DocumentList({ documents, isAdmin, showPassport }: DocumentListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [toRename, setToRename] = useState<DocumentDto | null>(null);
  const [toDelete, setToDelete] = useState<DocumentDto | null>(null);
  const deleteDocument = useDeleteDocument();

  const download = async (doc: DocumentDto) => {
    setDownloading(doc.docId);
    try {
      await downloadDocument(doc.docId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create a download link');
    } finally {
      setDownloading(null);
    }
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteDocument.mutate(toDelete.docId, {
      onSuccess: () => {
        toast.success('Document deleted', { description: toDelete.fileName });
        setToDelete(null);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete the document'),
    });
  };

  const actions = (doc: DocumentDto) => (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => download(doc)}
        loading={downloading === doc.docId}
        aria-label={`Download ${doc.fileName}`}
        title="Download"
      >
        {downloading !== doc.docId && <Download />}
      </Button>
      {isAdmin && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setToRename(doc)}
            aria-label={`Rename ${doc.fileName}`}
            title="Rename"
          >
            <Pencil />
          </Button>
          <Button
            variant="danger-ghost"
            size="icon-sm"
            onClick={() => setToDelete(doc)}
            aria-label={`Delete ${doc.fileName}`}
            title="Delete"
          >
            <Trash2 />
          </Button>
        </>
      )}
    </div>
  );

  const passportLink = (doc: DocumentDto) =>
    doc.passportId ? (
      <Link
        href={`/passports/${doc.passportId}`}
        className="font-mono text-xs text-ink-muted hover:text-accent"
      >
        {doc.passportId.slice(-8)}
      </Link>
    ) : (
      <span className="text-xs text-ink-subtle">Unlinked</span>
    );

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>File name</TH>
              <TH>Type</TH>
              <TH>Size</TH>
              {showPassport && <TH>Passport</TH>}
              <TH>Uploaded</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {documents.map((doc) => (
              <TR key={doc.docId} className="hover:bg-subtle/60">
                <TD className="max-w-xs">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                    <span className="truncate font-medium" title={doc.fileName}>
                      {doc.fileName}
                    </span>
                  </span>
                </TD>
                <TD>
                  <Badge>{mimeLabel(doc.mimeType)}</Badge>
                </TD>
                <TD className="text-ink-muted tabular-nums">{formatBytes(doc.size)}</TD>
                {showPassport && <TD>{passportLink(doc)}</TD>}
                <TD className="whitespace-nowrap text-ink-muted tabular-nums">{formatDate(doc.createdAt)}</TD>
                <TD>{actions(doc)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {documents.map((doc) => (
          <li key={doc.docId} className="flex items-center gap-3 px-4 py-3">
            <FileText className="size-4 shrink-0 text-ink-subtle" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{doc.fileName}</p>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {mimeLabel(doc.mimeType)} · {formatBytes(doc.size)} · {formatDate(doc.createdAt)}
              </p>
            </div>
            {actions(doc)}
          </li>
        ))}
      </ul>

      <RenameDocumentDialog document={toRename} onOpenChange={(open) => !open && setToRename(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete document?"
        description={
          <>
            <span className="font-medium text-ink">{toDelete?.fileName}</span> will be permanently removed
            from storage.
          </>
        }
        confirmLabel="Delete document"
        onConfirm={confirmDelete}
        pending={deleteDocument.isPending}
      />
    </>
  );
}

export function DocumentListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Loading documents">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
