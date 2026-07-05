"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinLoginResponseSchema = exports.PinLoginRequestSchema = exports.NfcLoginClaimResponseSchema = exports.NfcLoginPollResponseSchema = exports.AuthUserSchema = void 0;
const zod_1 = require("zod");
exports.AuthUserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    avatar: zod_1.z.string(),
    photo: zod_1.z.string().nullable(),
    color: zod_1.z.string(),
    role: zod_1.z.enum(['child', 'parent']),
    birthdate: zod_1.z.string().nullable(),
});
exports.NfcLoginPollResponseSchema = zod_1.z.object({
    pending: zod_1.z.boolean(),
});
exports.NfcLoginClaimResponseSchema = zod_1.z.object({
    user: exports.AuthUserSchema,
});
exports.PinLoginRequestSchema = zod_1.z.object({
    pin: zod_1.z.string().min(1),
});
exports.PinLoginResponseSchema = zod_1.z.object({
    user: exports.AuthUserSchema,
});
//# sourceMappingURL=auth.js.map