import { NextRequest } from 'next/server';
import { getSessionToken, removeSessionCookie } from '@/lib/auth/cookies';
import { revokeSession } from '@/lib/auth/session';
import { apiSuccess } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const token = getSessionToken(request);

    if (token) {
      await revokeSession(token);
    }

    const response = apiSuccess({ message: 'Signed out successfully' });
    return removeSessionCookie(response);
  } catch (error) {
    console.error('Logout error:', error);
    const response = apiSuccess({ message: 'Signed out successfully' });
    return removeSessionCookie(response);
  }
}
