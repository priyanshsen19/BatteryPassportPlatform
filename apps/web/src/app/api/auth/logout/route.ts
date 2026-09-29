import { NextResponse } from 'next/server';
import { clearSessionCookie, withJsonErrors } from '@/lib/server/session';

async function handlePOST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true, data: null });
}

export const POST = withJsonErrors(handlePOST);
