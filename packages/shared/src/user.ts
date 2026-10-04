import { z } from 'zod';

// Contracts of the admin Users view, shared by api, web and mobile.

export const USER_ROLES = ['admin', 'user'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * `invited`: created by an admin, has not chosen a password yet. `unconfirmed`: signed up but
 * has not entered the emailed code. `suspended`: cannot sign in.
 */
export type UserStatus = 'active' | 'invited' | 'unconfirmed' | 'suspended';

export const MAX_QUOTA_GB = 1000;

export const inviteUserRequestSchema = z.object({
  email: z.email().max(254),
});
export type InviteUserRequest = z.infer<typeof inviteUserRequestSchema>;

export const updateUserRequestSchema = z
  .object({
    /** Storage limit in whole gigabytes. */
    quotaGb: z.number().int().min(1).max(MAX_QUOTA_GB).optional(),
    role: z.enum(USER_ROLES).optional(),
    suspended: z.boolean().optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Send a quota, a role, or whether the account is suspended',
  });
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const deleteAccountRequestSchema = z.object({
  /** Proves it is the account's owner asking. Checked, never stored. */
  password: z.string().min(1).max(256),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  bytesUsed: number;
  quotaBytes: number;
  /** The caller's own account: some changes are not allowed on it. */
  isSelf: boolean;
}

export interface ListUsersResponse {
  users: UserResponse[];
}
