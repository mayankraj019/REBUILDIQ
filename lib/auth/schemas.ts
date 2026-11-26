import { z } from 'zod';

export const StrongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const NormalizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please provide a valid email address')
  .max(255, 'Email cannot exceed 255 characters');

export const RegisterInputSchema = z.object({
  email: NormalizedEmailSchema,
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name cannot exceed 100 characters'),
  password: StrongPasswordSchema,
});

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: NormalizedEmailSchema,
  password: z.string().min(1, 'Password is required').max(128, 'Password cannot exceed 128 characters'),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const ForgotPasswordInputSchema = z.object({
  email: NormalizedEmailSchema,
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResendConfirmationInputSchema = z.object({
  email: NormalizedEmailSchema,
});

export type ResendConfirmationInput = z.infer<typeof ResendConfirmationInputSchema>;

export const UpdatePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1).max(128).optional(),
    newPassword: StrongPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
    mode: z.enum(['change', 'recovery']).default('change'),
  })
  .superRefine((val, ctx) => {
    if (val.newPassword !== val.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'New password and confirmation do not match',
        path: ['confirmPassword'],
      });
    }
    if (val.mode === 'change' && (!val.currentPassword || !val.currentPassword.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Current password is required to change your password',
        path: ['currentPassword'],
      });
    }
  });

export type UpdatePasswordInput = z.infer<typeof UpdatePasswordInputSchema>;

export const UpdateProfileInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters long')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    defaultPromptTarget: z.enum(['antigravity', 'cursor', 'claude']).optional(),
  })
  .refine((val) => val.name !== undefined || val.defaultPromptTarget !== undefined, {
    message: 'Provide at least one profile field to update',
  });

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const LogoutInputSchema = z.object({
  scope: z.enum(['local', 'global', 'others']).default('local'),
});

export const RevokeSessionInputSchema = z
  .object({
    scope: z.enum(['single', 'others']).default('single'),
    sessionId: z.string().uuid('Invalid session identifier').optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scope === 'single' && !val.sessionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'sessionId is required when revoking an individual session',
        path: ['sessionId'],
      });
    }
  });

export const DeleteAccountInputSchema = z.object({
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Type DELETE exactly to confirm account removal' }),
  }),
  currentPassword: z
    .string()
    .min(1, 'Current password is required to delete your account')
    .max(128),
  reason: z.string().trim().max(300, 'Reason cannot exceed 300 characters').optional(),
});

export const UpdateBlueprintInputSchema = z.object({
  antigravityPrompts: z
    .string()
    .trim()
    .min(1, 'Prompt content cannot be empty')
    .max(100_000, 'Prompt content exceeds 100KB limit'),
});

export const CreateJobInputSchema = z.object({
  targetUrl: z
    .string()
    .trim()
    .min(1, 'Target URL is required')
    .max(2048, 'URL cannot exceed 2048 characters')
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Only HTTP and HTTPS URLs are supported'),
  crawlDepth: z.number().int().min(1).max(5).default(1),
  viewports: z
    .array(z.enum(['mobile', 'tablet', 'desktop']))
    .min(1, 'Select at least one viewport preset')
    .default(['desktop']),
});

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.string(),
  emailVerified: z.boolean().optional(),
  defaultPromptTarget: z.enum(['antigravity', 'cursor', 'claude']).optional(),
  createdAt: z.date().or(z.string()),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

const FORBIDDEN_OWNERSHIP_FIELDS = new Set([
  'userId',
  'user_id',
  'ownerId',
  'owner_id',
  'role',
  'isAdmin',
  'is_admin',
  'app_metadata',
  'appMetadata',
  'deletedAt',
  'deleted_at',
]);

/**
 * Inspects an untrusted JSON request body for client-supplied identity, ownership,
 * or privilege fields that must ONLY be derived server-side.
 */
export function findForbiddenClientOwnershipFields(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return [];
  }

  return Object.keys(payload as Record<string, unknown>).filter((key) =>
    FORBIDDEN_OWNERSHIP_FIELDS.has(key)
  );
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}
