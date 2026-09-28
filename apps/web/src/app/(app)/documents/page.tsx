'use client';

import { FileText } from 'lucide-react';
import { useState } from 'react';
import { DocumentList, DocumentListSkeleton } from '@/components/documents/document-list';
import { DocumentUpload } from '@/components/documents/document-upload';
import { PageTransition } from '@/components/layout/page-transition';
import { Field, Select } from '@/components/ui/form-controls';
import { Pagination } from '@/components/ui/pagination';
import { Card, EmptyState, ErrorState, PageHeader, Section } from '@/components/ui/surface';
import { useDocuments, useIsAdmin, usePassports } from '@/lib/queries';

const PAGE_SIZE = 20;

function UploadSection() {
  const [passportId, setPassportId] = useState('');
  const passports = usePassports({ limit: 100, sort: 'batteryIdentifier', order: 'asc' });

  return (
    <Section
      id="upload"
      title="Upload document"
      description="Optionally link the file to a battery passport."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_1fr]">
        <Field
          id="upload-passport"
          label="Passport"
          hint="Documents without a passport are stored as unlinked."
        >
          <Select
            id="upload-passport"
            value={passportId}
            onChange={(e) => setPassportId(e.target.value)}
            disabled={passports.isLoading}
            aria-describedby="upload-passport-hint"
          >
            <option value="">Not linked</option>
            {passports.data?.items.map((passport) => (
              <option key={passport.id} value={passport.id}>
                {passport.data.generalInformation.batteryIdentifier}
              </option>
            ))}
          </Select>
        </Field>
        <DocumentUpload passportId={passportId || undefined} />
      </div>
    </Section>
  );
}

export default function DocumentsPage() {
  const [page, setPage] = useState(1);
  const isAdmin = useIsAdmin();
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useDocuments({
    page,
    limit: PAGE_SIZE,
  });

  return (
    <PageTransition>
      <PageHeader
        title="Documents"
        description={
          data
            ? `${data.total} ${data.total === 1 ? 'file' : 'files'} in private S3 storage`
            : 'Files stored in private S3 storage'
        }
      />

      <div className="flex flex-col gap-5">
        {isAdmin && <UploadSection />}

        <Card className="overflow-hidden">
          {isLoading ? (
            <DocumentListSkeleton rows={5} />
          ) : isError ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : data && data.items.length > 0 ? (
            <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
              <DocumentList documents={data.items} isAdmin={isAdmin} showPassport />
              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={data.total}
                onPageChange={setPage}
                label="Documents"
              />
            </div>
          ) : (
            <EmptyState
              icon={<FileText />}
              title="No documents yet"
              description={
                isAdmin
                  ? 'Upload a file above to store it securely.'
                  : 'Documents uploaded by an administrator will appear here.'
              }
            />
          )}
        </Card>
      </div>
    </PageTransition>
  );
}
