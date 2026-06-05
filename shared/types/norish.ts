import { z } from 'zod';

export const MealSlotSchema = z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
export type MealSlot = z.infer<typeof MealSlotSchema>;

export const PlannedRecipeSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  slot: MealSlotSchema,
  sortOrder: z.number(),
  recipeId: z.string(),
  version: z.number(),
  recipeName: z.string().nullable(),
  recipeImage: z.string().nullable(),
  imageUrl: z.string().nullable(),
  servings: z.number().nullable(),
  calories: z.number().nullable(),
});
export type PlannedRecipe = z.infer<typeof PlannedRecipeSchema>;

export const GroceryItemSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  unit: z.string().nullable(),
  amount: z.number().nullable(),
  isDone: z.boolean(),
  storeId: z.string().nullable(),
  version: z.number(),
});
export type GroceryItem = z.infer<typeof GroceryItemSchema>;

export const GroceryCreateInputSchema = z.object({
  name: z.string().min(1),
  unit: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  isDone: z.boolean().optional(),
  storeId: z.string().nullable().optional(),
});
export type GroceryCreateInput = z.infer<typeof GroceryCreateInputSchema>;

export const GroceryToggleInputSchema = z.object({
  version: z.number(),
  isDone: z.boolean(),
});
export type GroceryToggleInput = z.infer<typeof GroceryToggleInputSchema>;

export const MealsResponseSchema = z.object({
  items: z.array(PlannedRecipeSchema),
  byDate: z.record(
    z.string(),
    z.record(MealSlotSchema, z.array(PlannedRecipeSchema)).partial(),
  ),
  fetched_at: z.string().datetime(),
  from_cache: z.boolean(),
});
export type MealsResponse = z.infer<typeof MealsResponseSchema>;

export const GroceriesResponseSchema = z.object({
  items: z.array(GroceryItemSchema),
  fetched_at: z.string().datetime(),
  from_cache: z.boolean(),
});
export type GroceriesResponse = z.infer<typeof GroceriesResponseSchema>;
