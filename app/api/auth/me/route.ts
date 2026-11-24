import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/middleware';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return apiError(
        'UNAUTHORIZED',
        'Authentication required',
        401
      );
    }

    return apiSuccess({ user: auth.user });
  } catch (error) {
    console.error('Get user error:', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while retrieving user profile',
      500
    );
  }
}
