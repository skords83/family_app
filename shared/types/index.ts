export interface User {
  id: string;
  name: string;
  avatar: string; // emoji or url
  color: string;  // hex
  pin: string | null;
  role: 'child' | 'parent';
}

export interface TaskTemplate {
  id: string;
  title: string;
  points: number;
  assigned_to: string | null; // user_id or null=all
  recurrence: 'daily' | 'weekly' | 'once';
  due_time: string | null; // "08:00"
  active: boolean;
}

export interface TaskInstance {
  id: string;
  template_id: string;
  assigned_to: string;
  date: string; // ISO date
  completed_at: string | null;
  completed_by: string | null;
  title: string; // joined from template
  points: number; // joined from template
}

export interface PointEvent {
  id: string;
  user_id: string;
  points: number;
  reason: string; // "task:uuid" | "reward:uuid" | "manual"
  created_at: string;
}

export interface Reward {
  id: string;
  title: string;
  points_cost: number;
  available_to: string | null;
  active: boolean;
}

export interface RewardClaim {
  id: string;
  reward_id: string;
  user_id: string;
  claimed_at: string;
  approved_at: string | null;
  reward_title?: string;
}

export interface WidgetConfig {
  widgets: WidgetItem[];
}

export interface WidgetItem {
  type: string;
  enabled: boolean;
  order: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color?: string;
}

export interface WeatherData {
  temperature: number;
  weathercode: number;
  windspeed: number;
  hourly?: { time: string; temperature: number; }[];
}

export interface MealPlan {
  days: { date: string; lunch: string; dinner: string; }[];
}

export interface CachedWidget<T> {
  data: T;
  fetched_at: string;
  source_url: string;
}
