import { z } from 'zod';

export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  photo: z.string().nullable(),
  color: z.string(),
  role: z.enum(['child', 'parent']),
  birthdate: z.string().nullable(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const NfcLoginPollResponseSchema = z.object({
  pending: z.boolean(),
});
export type NfcLoginPollResponse = z.infer<typeof NfcLoginPollResponseSchema>;

export const NfcLoginClaimResponseSchema = z.object({
  user: AuthUserSchema,
});
export type NfcLoginClaimResponse = z.infer<typeof NfcLoginClaimResponseSchema>;

export const PinLoginRequestSchema = z.object({
  pin: z.string().min(1),
});
export type PinLoginRequest = z.infer<typeof PinLoginRequestSchema>;

export const PinLoginResponseSchema = z.object({
  user: AuthUserSchema,
});
export type PinLoginResponse = z.infer<typeof PinLoginResponseSchema>;
