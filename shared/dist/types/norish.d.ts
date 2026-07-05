import { z } from 'zod';
export declare const MealSlotSchema: z.ZodEnum<["Breakfast", "Lunch", "Dinner", "Snack"]>;
export type MealSlot = z.infer<typeof MealSlotSchema>;
export declare const PlannedRecipeSchema: z.ZodObject<{
    id: z.ZodString;
    date: z.ZodString;
    slot: z.ZodEnum<["Breakfast", "Lunch", "Dinner", "Snack"]>;
    sortOrder: z.ZodNumber;
    recipeId: z.ZodString;
    version: z.ZodNumber;
    recipeName: z.ZodNullable<z.ZodString>;
    recipeImage: z.ZodNullable<z.ZodString>;
    imageUrl: z.ZodNullable<z.ZodString>;
    servings: z.ZodNullable<z.ZodNumber>;
    calories: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    date: string;
    slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
    sortOrder: number;
    recipeId: string;
    version: number;
    recipeName: string | null;
    recipeImage: string | null;
    imageUrl: string | null;
    servings: number | null;
    calories: number | null;
}, {
    id: string;
    date: string;
    slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
    sortOrder: number;
    recipeId: string;
    version: number;
    recipeName: string | null;
    recipeImage: string | null;
    imageUrl: string | null;
    servings: number | null;
    calories: number | null;
}>;
export type PlannedRecipe = z.infer<typeof PlannedRecipeSchema>;
export declare const GroceryItemSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodNullable<z.ZodString>;
    unit: z.ZodNullable<z.ZodString>;
    amount: z.ZodNullable<z.ZodNumber>;
    isDone: z.ZodBoolean;
    storeId: z.ZodNullable<z.ZodString>;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string | null;
    unit: string | null;
    version: number;
    amount: number | null;
    isDone: boolean;
    storeId: string | null;
}, {
    id: string;
    name: string | null;
    unit: string | null;
    version: number;
    amount: number | null;
    isDone: boolean;
    storeId: string | null;
}>;
export type GroceryItem = z.infer<typeof GroceryItemSchema>;
export declare const GroceryCreateInputSchema: z.ZodObject<{
    name: z.ZodString;
    unit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    isDone: z.ZodOptional<z.ZodBoolean>;
    storeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    unit?: string | null | undefined;
    amount?: number | null | undefined;
    isDone?: boolean | undefined;
    storeId?: string | null | undefined;
}, {
    name: string;
    unit?: string | null | undefined;
    amount?: number | null | undefined;
    isDone?: boolean | undefined;
    storeId?: string | null | undefined;
}>;
export type GroceryCreateInput = z.infer<typeof GroceryCreateInputSchema>;
export declare const GroceryToggleInputSchema: z.ZodObject<{
    version: z.ZodNumber;
    isDone: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    version: number;
    isDone: boolean;
}, {
    version: number;
    isDone: boolean;
}>;
export type GroceryToggleInput = z.infer<typeof GroceryToggleInputSchema>;
export declare const MealsResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        date: z.ZodString;
        slot: z.ZodEnum<["Breakfast", "Lunch", "Dinner", "Snack"]>;
        sortOrder: z.ZodNumber;
        recipeId: z.ZodString;
        version: z.ZodNumber;
        recipeName: z.ZodNullable<z.ZodString>;
        recipeImage: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        servings: z.ZodNullable<z.ZodNumber>;
        calories: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        date: string;
        slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
        sortOrder: number;
        recipeId: string;
        version: number;
        recipeName: string | null;
        recipeImage: string | null;
        imageUrl: string | null;
        servings: number | null;
        calories: number | null;
    }, {
        id: string;
        date: string;
        slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
        sortOrder: number;
        recipeId: string;
        version: number;
        recipeName: string | null;
        recipeImage: string | null;
        imageUrl: string | null;
        servings: number | null;
        calories: number | null;
    }>, "many">;
    byDate: z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        date: z.ZodString;
        slot: z.ZodEnum<["Breakfast", "Lunch", "Dinner", "Snack"]>;
        sortOrder: z.ZodNumber;
        recipeId: z.ZodString;
        version: z.ZodNumber;
        recipeName: z.ZodNullable<z.ZodString>;
        recipeImage: z.ZodNullable<z.ZodString>;
        imageUrl: z.ZodNullable<z.ZodString>;
        servings: z.ZodNullable<z.ZodNumber>;
        calories: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        date: string;
        slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
        sortOrder: number;
        recipeId: string;
        version: number;
        recipeName: string | null;
        recipeImage: string | null;
        imageUrl: string | null;
        servings: number | null;
        calories: number | null;
    }, {
        id: string;
        date: string;
        slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
        sortOrder: number;
        recipeId: string;
        version: number;
        recipeName: string | null;
        recipeImage: string | null;
        imageUrl: string | null;
        servings: number | null;
        calories: number | null;
    }>, "many">>>>;
    fetched_at: z.ZodString;
    from_cache: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    fetched_at: string;
    from_cache: boolean;
    items: {
        id: string;
        date: string;
        slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
        sortOrder: number;
        recipeId: string;
        version: number;
        recipeName: string | null;
        recipeImage: string | null;
        imageUrl: string | null;
        servings: number | null;
        calories: number | null;
    }[];
    byDate: Record<string, Record<string, {
        id: string;
        date: string;
        slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
        sortOrder: number;
        recipeId: string;
        version: number;
        recipeName: string | null;
        recipeImage: string | null;
        imageUrl: string | null;
        servings: number | null;
        calories: number | null;
    }[] | undefined>>;
}, {
    fetched_at: string;
    from_cache: boolean;
    items: {
        id: string;
        date: string;
        slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
        sortOrder: number;
        recipeId: string;
        version: number;
        recipeName: string | null;
        recipeImage: string | null;
        imageUrl: string | null;
        servings: number | null;
        calories: number | null;
    }[];
    byDate: Record<string, Record<string, {
        id: string;
        date: string;
        slot: "Breakfast" | "Lunch" | "Dinner" | "Snack";
        sortOrder: number;
        recipeId: string;
        version: number;
        recipeName: string | null;
        recipeImage: string | null;
        imageUrl: string | null;
        servings: number | null;
        calories: number | null;
    }[] | undefined>>;
}>;
export type MealsResponse = z.infer<typeof MealsResponseSchema>;
export declare const GroceriesResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodNullable<z.ZodString>;
        unit: z.ZodNullable<z.ZodString>;
        amount: z.ZodNullable<z.ZodNumber>;
        isDone: z.ZodBoolean;
        storeId: z.ZodNullable<z.ZodString>;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string | null;
        unit: string | null;
        version: number;
        amount: number | null;
        isDone: boolean;
        storeId: string | null;
    }, {
        id: string;
        name: string | null;
        unit: string | null;
        version: number;
        amount: number | null;
        isDone: boolean;
        storeId: string | null;
    }>, "many">;
    fetched_at: z.ZodString;
    from_cache: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    fetched_at: string;
    from_cache: boolean;
    items: {
        id: string;
        name: string | null;
        unit: string | null;
        version: number;
        amount: number | null;
        isDone: boolean;
        storeId: string | null;
    }[];
}, {
    fetched_at: string;
    from_cache: boolean;
    items: {
        id: string;
        name: string | null;
        unit: string | null;
        version: number;
        amount: number | null;
        isDone: boolean;
        storeId: string | null;
    }[];
}>;
export type GroceriesResponse = z.infer<typeof GroceriesResponseSchema>;
//# sourceMappingURL=norish.d.ts.map