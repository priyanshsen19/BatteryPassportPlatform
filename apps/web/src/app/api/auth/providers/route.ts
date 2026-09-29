import { NextResponse, type NextRequest } from 'next/server';
import { googleConfig } from '@/lib/server/google';
import { withJsonErrors } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** Tells the login page which sign-in methods are available in this deployment. */
function handleGET(request: NextRequest) {
  return NextResponse.json({ success: true, data: { google: googleConfig(request) !== null } });
}

export const GET = withJsonErrors(handleGET);
