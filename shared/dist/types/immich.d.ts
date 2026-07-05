import { z } from 'zod';
export declare const ImmichAssetSchema: z.ZodObject<{
    id: z.ZodString;
    originalPath: z.ZodString;
    originalFileName: z.ZodString;
    fileCreatedAt: z.ZodString;
    type: z.ZodString;
    exifInfo: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
        city?: string | null | undefined;
        country?: string | null | undefined;
    }, {
        description?: string | undefined;
        city?: string | null | undefined;
        country?: string | null | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: string;
    originalPath: string;
    originalFileName: string;
    fileCreatedAt: string;
    exifInfo?: {
        description?: string | undefined;
        city?: string | null | undefined;
        country?: string | null | undefined;
    } | undefined;
}, {
    id: string;
    type: string;
    originalPath: string;
    originalFileName: string;
    fileCreatedAt: string;
    exifInfo?: {
        description?: string | undefined;
        city?: string | null | undefined;
        country?: string | null | undefined;
    } | undefined;
}>;
export type ImmichAsset = z.infer<typeof ImmichAssetSchema>;
export declare const ImmichWidgetDataSchema: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    thumbnailUrl: z.ZodString;
    fileName: z.ZodString;
    createdAt: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    url: string;
    thumbnailUrl: string;
    fileName: string;
    createdAt: string;
    description?: string | undefined;
    location?: string | undefined;
}, {
    id: string;
    url: string;
    thumbnailUrl: string;
    fileName: string;
    createdAt: string;
    description?: string | undefined;
    location?: string | undefined;
}>;
export type ImmichWidgetData = z.infer<typeof ImmichWidgetDataSchema>;
export declare const ImmichResponseSchema: z.ZodObject<{
    data: z.ZodObject<{
        id: z.ZodString;
        url: z.ZodString;
        thumbnailUrl: z.ZodString;
        fileName: z.ZodString;
        createdAt: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        location: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        url: string;
        thumbnailUrl: string;
        fileName: string;
        createdAt: string;
        description?: string | undefined;
        location?: string | undefined;
    }, {
        id: string;
        url: string;
        thumbnailUrl: string;
        fileName: string;
        createdAt: string;
        description?: string | undefined;
        location?: string | undefined;
    }>;
    fetched_at: z.ZodString;
    from_cache: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    fetched_at: string;
    from_cache: boolean;
    data: {
        id: string;
        url: string;
        thumbnailUrl: string;
        fileName: string;
        createdAt: string;
        description?: string | undefined;
        location?: string | undefined;
    };
}, {
    fetched_at: string;
    from_cache: boolean;
    data: {
        id: string;
        url: string;
        thumbnailUrl: string;
        fileName: string;
        createdAt: string;
        description?: string | undefined;
        location?: string | undefined;
    };
}>;
export type ImmichResponse = z.infer<typeof ImmichResponseSchema>;
//# sourceMappingURL=immich.d.ts.map