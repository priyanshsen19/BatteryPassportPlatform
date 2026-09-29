import { NextResponse, after } from 'next/server';
import { wakeServices } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/**
 * Called when any page of the web app opens: starts waking the backend services (which sleep
 * when idle on free hosting) so they are ready by the time the visitor needs them. The response
 * returns immediately; `after` keeps the server (or serverless function) alive to send the pings.
 */
export function POST() {
  after(wakeServices);
  return new NextResponse(null, { status: 204 });
}
