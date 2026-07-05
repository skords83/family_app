"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroceriesResponseSchema = exports.MealsResponseSchema = exports.GroceryToggleInputSchema = exports.GroceryCreateInputSchema = exports.GroceryItemSchema = exports.PlannedRecipeSchema = exports.MealSlotSchema = void 0;
const zod_1 = require("zod");
exports.MealSlotSchema = zod_1.z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack']);
exports.PlannedRecipeSchema = zod_1.z.object({
    id: zod_1.z.string(),
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    slot: exports.MealSlotSchema,
    sortOrder: zod_1.z.number(),
    recipeId: zod_1.z.string(),
    version: zod_1.z.number(),
    recipeName: zod_1.z.string().nullable(),
    recipeImage: zod_1.z.string().nullable(),
    imageUrl: zod_1.z.string().nullable(),
    servings: zod_1.z.number().nullable(),
    calories: zod_1.z.number().nullable(),
});
exports.GroceryItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().nullable(),
    unit: zod_1.z.string().nullable(),
    amount: zod_1.z.number().nullable(),
    isDone: zod_1.z.boolean(),
    storeId: zod_1.z.string().nullable(),
    version: zod_1.z.number(),
});
exports.GroceryCreateInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    unit: zod_1.z.string().nullable().optional(),
    amount: zod_1.z.number().nullable().optional(),
    isDone: zod_1.z.boolean().optional(),
    storeId: zod_1.z.string().nullable().optional(),
});
exports.GroceryToggleInputSchema = zod_1.z.object({
    version: zod_1.z.number(),
    isDone: zod_1.z.boolean(),
});
exports.MealsResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.PlannedRecipeSchema),
    byDate: zod_1.z.record(zod_1.z.string(), zod_1.z.record(zod_1.z.string(), zod_1.z.array(exports.PlannedRecipeSchema).optional())),
    fetched_at: zod_1.z.string().datetime(),
    from_cache: zod_1.z.boolean(),
});
exports.GroceriesResponseSchema = zod_1.z.object({
    items: zod_1.z.array(exports.GroceryItemSchema),
    fetched_at: zod_1.z.string().datetime(),
    from_cache: zod_1.z.boolean(),
});
//# sourceMappingURL=norish.js.map