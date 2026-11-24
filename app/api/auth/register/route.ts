import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { attachSessionCookie } from '@/lib/auth/cookies';
import { RegisterInputSchema } from '@/lib/auth/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = RegisterInputSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid registration data',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, name, password } = parsed.data;

    // Check for existing account
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return apiError(
        'ACCOUNT_EXISTS',
        'An account with this email address already exists',
        409
      );
    }

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Create session
    const ipAddress = request.headers.get('x-forwarded-for') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    const { rawToken, expiresAt } = await createSession(user.id, {
      ipAddress,
      userAgent,
    });

    const response = apiSuccess({ user }, 201);
    return attachSessionCookie(response, rawToken, expiresAt);
  } catch (error) {
    console.error('Registration error:', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred during registration',
      500
    );
  }
}
