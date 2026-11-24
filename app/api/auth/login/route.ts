import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { attachSessionCookie } from '@/lib/auth/cookies';
import { LoginInputSchema } from '@/lib/auth/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = LoginInputSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid login credentials provided',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, password } = parsed.data;

    // Query user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return apiError(
        'INVALID_CREDENTIALS',
        'Invalid email or password',
        401
      );
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      return apiError(
        'INVALID_CREDENTIALS',
        'Invalid email or password',
        401
      );
    }

    // Create session
    const ipAddress = request.headers.get('x-forwarded-for') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    const { rawToken, expiresAt } = await createSession(user.id, {
      ipAddress,
      userAgent,
    });

    const response = apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });

    return attachSessionCookie(response, rawToken, expiresAt);
  } catch (error) {
    console.error('Login error:', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred during login',
      500
    );
  }
}
