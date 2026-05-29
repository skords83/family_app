export const WIDGET_TYPES = {
  CALENDAR: 'calendar',
  TASKS: 'tasks',
  MEALS: 'meals',
  IMMICH: 'immich',
  WEATHER: 'weather',
  CLOCK: 'clock',
} as const;

export const POINT_EVENT_REASONS = {
  TASK: 'task',
  REWARD: 'reward',
  MANUAL: 'manual',
} as const;

export const DEFAULT_WIDGETS: import('../types').WidgetItem[] = [
  { type: 'clock', enabled: true, order: 0 },
  { type: 'calendar', enabled: true, order: 1 },
  { type: 'tasks', enabled: true, order: 2 },
  { type: 'weather', enabled: true, order: 3 },
  { type: 'meals', enabled: true, order: 4 },
  { type: 'immich', enabled: true, order: 5 },
];
