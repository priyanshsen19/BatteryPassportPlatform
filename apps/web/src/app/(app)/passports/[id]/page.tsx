'use client';

import type { PassportDto } from '@bpp/shared/schemas';
import { ChevronLeft, FileText, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { DocumentList, DocumentListSkeleton } from '@/components/documents/document-list';
import { DocumentUpload } from '@/components/documents/document-upload';
import { PageTransition } from '@/components/layout/page-transition';
import { DeletePassportDialog } from '@/components/passports/delete-passport-dialog';
import { CategoryBadge, StatusBadge } from '@/components/passports/passport-badges';
import { PassportHeroCard } from '@/components/passports/passport-card';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Section, Skeleton } from '@/components/ui/surface';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { useCan, useDocuments, usePassport } from '@/lib/queries';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';

function Detail({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className={`mt-1 text-sm break-words text-ink ${mono ? 'font-mono text-[13px]' : ''}`}>
        {children}
      </dd>
    </div>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>;
}

function PassportDocuments({ passportId }: { passportId: string }) {
  const canUpload = useCan('document:upload');
  const { data, isLoading, isError, error, refetch } = useDocuments({ passportId, limit: 100 });

  return (
    <Section
      id="documents"
      title="Documents"
      description="Certificates, reports and other files stored for this passport."
      className="overflow-hidden"
    >
      <div className="-m-5">
        {canUpload && (
          <div className="border-b border-line p-5">
            <DocumentUpload passportId={passportId} />
          </div>
        )}
        {isLoading ? (
          <DocumentListSkeleton />
        ) : isError ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : data && data.items.length > 0 ? (
          <DocumentList documents={data.items} />
        ) : (
          <EmptyState
            icon={<FileText />}
            title="No documents"
            description={
              canUpload
                ? 'Upload a file above to attach it to this passport.'
                : 'No files have been attached to this passport.'
            }
          />
        )}
      </div>
    </Section>
  );
}

function PassportDetail({ passport }: { passport: PassportDto }) {
  const { generalInformation: info, materialComposition: materials, carbonFootprint: carbon } = passport.data;

  return (
    <div className="flex flex-col gap-5">
      <PassportHeroCard passport={passport} />

      <Section id="general" title="General information">
        <DetailGrid>
          <Detail label="Battery identifier" mono>
            {info.batteryIdentifier}
          </Detail>
          <Detail label="Model">
            {info.batteryModel.modelName}
            <span className="ml-2 font-mono text-xs text-ink-subtle">{info.batteryModel.id}</span>
          </Detail>
          <Detail label="Category">
            <CategoryBadge category={info.batteryCategory} />
          </Detail>
          <Detail label="Status">
            <StatusBadge status={info.batteryStatus} />
          </Detail>
          <Detail label="Battery mass">{formatNumber(info.batteryMass)} kg</Detail>
          <Detail label="Manufacturing date">{formatDate(info.manufacturingDate)}</Detail>
          <Detail label="Manufacturing place">{info.manufacturingPlace}</Detail>
          <Detail label="Warranty period">
            {info.warrantyPeriod}{' '}
            {/^\d+$/.test(info.warrantyPeriod) ? (info.warrantyPeriod === '1' ? 'year' : 'years') : ''}
          </Detail>
        </DetailGrid>
      </Section>

      <Section id="manufacturer" title="Manufacturer information">
        <DetailGrid>
          <Detail label="Manufacturer name">{info.manufacturerInformation.manufacturerName}</Detail>
          <Detail label="Manufacturer identifier" mono>
            {info.manufacturerInformation.manufacturerIdentifier}
          </Detail>
        </DetailGrid>
      </Section>

      <Section id="materials" title="Material composition">
        <DetailGrid>
          <Detail label="Battery chemistry">{materials.batteryChemistry}</Detail>
          <div className="sm:col-span-2">
            <dt className="text-xs text-ink-muted">Critical raw materials</dt>
            <dd className="mt-1.5">
              <ul className="flex flex-wrap gap-1.5">
                {materials.criticalRawMaterials.map((material) => (
                  <li
                    key={material}
                    className="rounded-md border border-line bg-subtle px-2 py-0.5 text-[13px] text-ink"
                  >
                    {material}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </DetailGrid>
      </Section>

      <Section id="hazardous" title="Hazardous substances" className="overflow-hidden">
        {materials.hazardousSubstances.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No hazardous substances declared.</p>
        ) : (
          <div className="-m-5">
            <Table>
              <THead>
                <TR>
                  <TH>Substance</TH>
                  <TH>Chemical formula</TH>
                  <TH>CAS number</TH>
                </TR>
              </THead>
              <TBody>
                {materials.hazardousSubstances.map((substance) => (
                  <TR key={`${substance.casNumber}-${substance.substanceName}`}>
                    <TD>{substance.substanceName}</TD>
                    <TD className="font-mono text-[13px]">{substance.chemicalFormula}</TD>
                    <TD className="font-mono text-[13px] text-ink-muted">{substance.casNumber}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Section>

      <Section id="carbon" title="Carbon footprint">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-10">
          <div>
            <p className="text-xs text-ink-muted">Total carbon footprint</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-ink tabular-nums">
              {formatNumber(carbon.totalCarbonFootprint)}
              <span className="ml-2 text-base font-normal text-ink-muted">{carbon.measurementUnit}</span>
            </p>
          </div>
          <dl>
            <Detail label="Methodology">{carbon.methodology}</Detail>
          </dl>
        </div>
      </Section>

      <PassportDocuments passportId={passport.id} />

      <p className="text-xs text-ink-subtle">Created {formatDateTime(passport.createdAt)}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading passport">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="p-5">
          <Skeleton className="mb-5 h-4 w-40" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <div key={j}>
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function PassportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canEdit = useCan('passport:update');
  const canDelete = useCan('passport:delete');
  const { data: passport, isLoading, isError, error, refetch } = usePassport(id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = (
    <Link href="/passports" className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
      <ChevronLeft className="size-3.5" aria-hidden />
      Passports
    </Link>
  );

  if (isError) {
    const missing = error instanceof ApiError && (error.status === 404 || error.status === 400);
    return (
      <>
        <PageHeader eyebrow={back} title={missing ? 'Passport not found' : 'Battery passport'} />
        <Card>
          {missing ? (
            <EmptyState
              icon={<FileText />}
              title="This passport does not exist"
              description="It may have been deleted, or the link is incorrect."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/passports">Back to passports</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          )}
        </Card>
      </>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        eyebrow={back}
        title="Passport details"
        description={
          passport
            ? `${passport.data.generalInformation.batteryModel.modelName} · ${passport.data.generalInformation.manufacturerInformation.manufacturerName}`
            : undefined
        }
        actions={
          passport &&
          (canEdit || canDelete) && (
            <>
              {canDelete && (
                <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
                  <Trash2 />
                  Delete
                </Button>
              )}
              {canEdit && (
                <Button asChild>
                  <Link href={`/passports/${passport.id}/edit`}>
                    <Pencil />
                    Edit
                  </Link>
                </Button>
              )}
            </>
          )
        }
      />

      {isLoading || !passport ? <DetailSkeleton /> : <PassportDetail passport={passport} />}

      <DeletePassportDialog
        passport={confirmDelete && passport ? passport : null}
        onOpenChange={setConfirmDelete}
        onDeleted={() => router.replace('/passports')}
      />
    </PageTransition>
  );
}
