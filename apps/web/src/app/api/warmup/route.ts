import { NextResponse } from 'next/server';
import { wakeServices } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/**
 * Called when the sign-in page opens: starts waking the backend services (which sleep when idle
 * on free hosting) so they are ready by the time the visitor has signed in.
 */
export function POST() {
  wakeServices();
  return new NextResponse(null, { status: 204 });
}
