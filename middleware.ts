import { type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    /*
     * Refresh Supabase sessions across all HTML & API routes except Next.js internals
     * and static brand/image assets.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|brand/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
