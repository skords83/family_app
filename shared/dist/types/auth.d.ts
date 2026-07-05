import { z } from 'zod';
export declare const AuthUserSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    avatar: z.ZodString;
    photo: z.ZodNullable<z.ZodString>;
    color: z.ZodString;
    role: z.ZodEnum<["child", "parent"]>;
    birthdate: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    avatar: string;
    photo: string | null;
    color: string;
    role: "child" | "parent";
    birthdate: string | null;
}, {
    id: string;
    name: string;
    avatar: string;
    photo: string | null;
    color: string;
    role: "child" | "parent";
    birthdate: string | null;
}>;
export type AuthUser = z.infer<typeof AuthUserSchema>;
export declare const NfcLoginPollResponseSchema: z.ZodObject<{
    pending: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    pending: boolean;
}, {
    pending: boolean;
}>;
export type NfcLoginPollResponse = z.infer<typeof NfcLoginPollResponseSchema>;
export declare const NfcLoginClaimResponseSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        avatar: z.ZodString;
        photo: z.ZodNullable<z.ZodString>;
        color: z.ZodString;
        role: z.ZodEnum<["child", "parent"]>;
        birthdate: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        avatar: string;
        photo: string | null;
        color: string;
        role: "child" | "parent";
        birthdate: string | null;
    }, {
        id: string;
        name: string;
        avatar: string;
        photo: string | null;
        color: string;
        role: "child" | "parent";
        birthdate: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        name: string;
        avatar: string;
        photo: string | null;
        color: string;
        role: "child" | "parent";
        birthdate: string | null;
    };
}, {
    user: {
        id: string;
        name: string;
        avatar: string;
        photo: string | null;
        color: string;
        role: "child" | "parent";
        birthdate: string | null;
    };
}>;
export type NfcLoginClaimResponse = z.infer<typeof NfcLoginClaimResponseSchema>;
export declare const PinLoginRequestSchema: z.ZodObject<{
    pin: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pin: string;
}, {
    pin: string;
}>;
export type PinLoginRequest = z.infer<typeof PinLoginRequestSchema>;
export declare const PinLoginResponseSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        avatar: z.ZodString;
        photo: z.ZodNullable<z.ZodString>;
        color: z.ZodString;
        role: z.ZodEnum<["child", "parent"]>;
        birthdate: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        avatar: string;
        photo: string | null;
        color: string;
        role: "child" | "parent";
        birthdate: string | null;
    }, {
        id: string;
        name: string;
        avatar: string;
        photo: string | null;
        color: string;
        role: "child" | "parent";
        birthdate: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    user: {
        id: string;
        name: string;
        avatar: string;
        photo: string | null;
        color: string;
        role: "child" | "parent";
        birthdate: string | null;
    };
}, {
    user: {
        id: string;
        name: string;
        avatar: string;
        photo: string | null;
        color: string;
        role: "child" | "parent";
        birthdate: string | null;
    };
}>;
export type PinLoginResponse = z.infer<typeof PinLoginResponseSchema>;
//# sourceMappingURL=auth.d.ts.map