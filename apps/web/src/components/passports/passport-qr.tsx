'use client';

import { Check, Copy, Maximize2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/surface';
import { useOrigin } from '@/lib/hooks';
import { cn } from '@/lib/utils';

export function usePassportUrl(passportId: string): string {
  const origin = useOrigin();
  return origin ? `${origin}/passports/${passportId}` : '';
}

function QrImage({ value, size, label }: { value: string; size: number; label: string }) {
  if (!value) return <Skeleton className="rounded-md" style={{ width: size, height: size }} />;
  return (
    <QRCodeSVG
      value={value}
      size={size}
      level="M"
      marginSize={0}
      fgColor="#26292c"
      bgColor="#ffffff"
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

function CopyLinkButton({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Passport link copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the link');
    }
  };
  return (
    <Button variant="secondary" size="sm" onClick={copy} disabled={!url} className={className}>
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}

interface PassportQrProps {
  passportId: string;
  identifier: string;
  size?: number;
  className?: string;
}

/** QR code that opens this passport's page; click to enlarge for scanning. */
export function PassportQr({ passportId, identifier, size = 104, className }: PassportQrProps) {
  const url = usePassportUrl(passportId);
  const [expanded, setExpanded] = useState(false);
  const label = `QR code linking to passport ${identifier}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn(
          'group relative rounded-lg bg-white p-2.5 shadow-card ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 hover:shadow-raised',
          className,
        )}
        aria-label={`Enlarge QR code for ${identifier}`}
      >
        <QrImage value={url} size={size} label={label} />
        <span className="absolute -right-2 -bottom-2 flex size-6 items-center justify-center rounded-full border border-line bg-surface text-ink-muted opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="size-3" aria-hidden />
        </span>
      </button>

      <Dialog
        open={expanded}
        onOpenChange={setExpanded}
        title={`Passport ${identifier}`}
        description="Scan to open this battery passport."
        className="max-w-sm"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/5">
            <QrImage value={url} size={232} label={label} />
          </div>
          <p
            className="w-full truncate rounded-md bg-subtle px-3 py-2 text-center font-mono text-xs text-ink-muted"
            title={url}
          >
            {url}
          </p>
          <CopyLinkButton url={url} className="w-full" />
        </div>
      </Dialog>
    </>
  );
}

export { CopyLinkButton };
