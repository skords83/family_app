"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImmichResponseSchema = exports.ImmichWidgetDataSchema = exports.ImmichAssetSchema = void 0;
const zod_1 = require("zod");
exports.ImmichAssetSchema = zod_1.z.object({
    id: zod_1.z.string(),
    originalPath: zod_1.z.string(),
    originalFileName: zod_1.z.string(),
    fileCreatedAt: zod_1.z.string(),
    type: zod_1.z.string(),
    exifInfo: zod_1.z
        .object({
        description: zod_1.z.string().optional(),
        city: zod_1.z.string().nullable().optional(),
        country: zod_1.z.string().nullable().optional(),
    })
        .optional(),
});
exports.ImmichWidgetDataSchema = zod_1.z.object({
    id: zod_1.z.string(),
    url: zod_1.z.string(),
    thumbnailUrl: zod_1.z.string(),
    fileName: zod_1.z.string(),
    createdAt: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
});
exports.ImmichResponseSchema = zod_1.z.object({
    data: exports.ImmichWidgetDataSchema,
    fetched_at: zod_1.z.string().datetime(),
    from_cache: zod_1.z.boolean(),
});
//# sourceMappingURL=immich.js.map