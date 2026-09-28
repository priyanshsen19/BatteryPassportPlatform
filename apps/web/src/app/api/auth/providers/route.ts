import { NextResponse, type NextRequest } from 'next/server';
import { googleConfig } from '@/lib/server/google';

export const dynamic = 'force-dynamic';

/** Tells the login page which sign-in methods are available in this deployment. */
export function GET(request: NextRequest) {
  return NextResponse.json({ success: true, data: { google: googleConfig(request) !== null } });
}
