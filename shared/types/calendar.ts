import { z } from 'zod';

export const CalendarEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  allDay: z.boolean(),
  color: z.string().optional(),
  calendarName: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarMetaSchema = z.object({
  url: z.string(),
  color: z.string(),
  name: z.string(),
});
export type CalendarMeta = z.infer<typeof CalendarMetaSchema>;

export const CalendarResponseSchema = z.object({
  events: z.array(CalendarEventSchema),
  fetched_at: z.string().datetime(),
  from_cache: z.boolean(),
});
export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;

export const CalendarCreateInputSchema = z.object({
  title: z.string().min(1),
  start: z.string().datetime(),
  end: z.string().datetime(),
  allDay: z.boolean(),
  calendarUrl: z.string().url(),
});
export type CalendarCreateInput = z.infer<typeof CalendarCreateInputSchema>;