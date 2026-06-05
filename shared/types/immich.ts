import { z } from 'zod';

export const ImmichAssetSchema = z.object({
  id: z.string(),
  originalPath: z.string(),
  originalFileName: z.string(),
  fileCreatedAt: z.string(),
  type: z.string(),
  exifInfo: z
    .object({
      description: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
});
export type ImmichAsset = z.infer<typeof ImmichAssetSchema>;

export const ImmichWidgetDataSchema = z.object({
  id: z.string(),
  url: z.string(),
  thumbnailUrl: z.string(),
  fileName: z.string(),
  createdAt: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
});
export type ImmichWidgetData = z.infer<typeof ImmichWidgetDataSchema>;

export const ImmichResponseSchema = z.object({
  data: ImmichWidgetDataSchema,
  fetched_at: z.string().datetime(),
  from_cache: z.boolean(),
});
export type ImmichResponse = z.infer<typeof ImmichResponseSchema>;
