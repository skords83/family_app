import { z } from 'zod';
export declare const CalendarEventSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    start: z.ZodString;
    end: z.ZodString;
    allDay: z.ZodBoolean;
    color: z.ZodOptional<z.ZodString>;
    calendarName: z.ZodOptional<z.ZodString>;
    recurring: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    color?: string | undefined;
    calendarName?: string | undefined;
    recurring?: boolean | undefined;
}, {
    id: string;
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    color?: string | undefined;
    calendarName?: string | undefined;
    recurring?: boolean | undefined;
}>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export declare const CalendarMetaSchema: z.ZodObject<{
    url: z.ZodString;
    color: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    color: string;
    url: string;
}, {
    name: string;
    color: string;
    url: string;
}>;
export type CalendarMeta = z.infer<typeof CalendarMetaSchema>;
export declare const CalendarResponseSchema: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        start: z.ZodString;
        end: z.ZodString;
        allDay: z.ZodBoolean;
        color: z.ZodOptional<z.ZodString>;
        calendarName: z.ZodOptional<z.ZodString>;
        recurring: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        start: string;
        end: string;
        allDay: boolean;
        color?: string | undefined;
        calendarName?: string | undefined;
        recurring?: boolean | undefined;
    }, {
        id: string;
        title: string;
        start: string;
        end: string;
        allDay: boolean;
        color?: string | undefined;
        calendarName?: string | undefined;
        recurring?: boolean | undefined;
    }>, "many">;
    fetched_at: z.ZodString;
    from_cache: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    events: {
        id: string;
        title: string;
        start: string;
        end: string;
        allDay: boolean;
        color?: string | undefined;
        calendarName?: string | undefined;
        recurring?: boolean | undefined;
    }[];
    fetched_at: string;
    from_cache: boolean;
}, {
    events: {
        id: string;
        title: string;
        start: string;
        end: string;
        allDay: boolean;
        color?: string | undefined;
        calendarName?: string | undefined;
        recurring?: boolean | undefined;
    }[];
    fetched_at: string;
    from_cache: boolean;
}>;
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
export declare const CalendarCreateInputSchema: z.ZodObject<{
    title: z.ZodString;
    start: z.ZodString;
    end: z.ZodString;
    allDay: z.ZodBoolean;
    calendarUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    calendarUrl: string;
}, {
    title: string;
    start: string;
    end: string;
    allDay: boolean;
    calendarUrl: string;
}>;
export type CalendarCreateInput = z.infer<typeof CalendarCreateInputSchema>;
//# sourceMappingURL=calendar.d.ts.map