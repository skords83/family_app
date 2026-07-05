"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WIDGETS = exports.POINT_EVENT_REASONS = exports.WIDGET_TYPES = void 0;
exports.WIDGET_TYPES = {
    CALENDAR: 'calendar',
    TASKS: 'tasks',
    MEALS: 'meals',
    IMMICH: 'immich',
    WEATHER: 'weather',
    CLOCK: 'clock',
};
exports.POINT_EVENT_REASONS = {
    TASK: 'task',
    REWARD: 'reward',
    MANUAL: 'manual',
};
exports.DEFAULT_WIDGETS = [
    { type: 'clock', enabled: true, order: 0 },
    { type: 'calendar', enabled: true, order: 1 },
    { type: 'tasks', enabled: true, order: 2 },
    { type: 'weather', enabled: true, order: 3 },
    { type: 'meals', enabled: true, order: 4 },
    { type: 'immich', enabled: true, order: 5 },
];
//# sourceMappingURL=index.js.map