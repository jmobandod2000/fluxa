import type { SiteSummary } from 'src/modules/organization/interfaces/organization';

export type TurnStatus = 'WAITING' | 'CALLED' | 'DONE' | 'NO_SHOW' | 'CANCELLED';

export interface SectionSummary {
  id: number;
  name: string;
  prefix: string;
  color: string | null;
}

export interface Section extends SectionSummary {
  description: string | null;
  sortOrder: number;
  bookable: boolean;
  durationMinutes: number;
  isActive: boolean;
}

export interface SectionPayload {
  name: string;
  prefix: string;
  description?: string | null;
  color?: string | null;
  bookable?: boolean;
  durationMinutes?: number;
  isActive?: boolean;
}

export interface Counter {
  id: number;
  name: string;
  siteId: number | null;
  isActive: boolean;
  Sections: SectionSummary[];
  Site: SiteSummary | null;
  Schedules: ScheduleBlock[];
}

export interface CounterPayload {
  name: string;
  siteId: number | null;
  sectionIds: number[];
  schedules?: ScheduleBlock[];
  isActive?: boolean;
}

export interface Turn {
  id: number;
  code: string;
  status: TurnStatus;
  sectionId: number;
  siteId: number | null;
  recallCount: number;
  createdAt: string;
  calledAt: string | null;
  Section: SectionSummary;
  Counter: { id: number; name: string } | null;
}

export interface TurnStats {
  served: number;
  avgWaitMinutes: number | null;
  avgServiceMinutes: number | null;
}

export interface StaffState {
  counter: Counter;
  current: Turn | null;
  waiting: Turn[];
  stats: TurnStats;
}

export interface TodaySummary extends TurnStats {
  issued: number;
  waiting: number;
  inService: number;
  noShow: number;
}

export interface PublicTurn {
  code: string;
  status: TurnStatus;
  token: string;
  section: string;
  color: string | null;
  counter: string | null;
  ahead: number;
  createdAt: string;
  calledAt: string | null;
  serviceDate: string;
}

export interface PublicConfig {
  name: string | null;
  businessType: string | null;
  sections: (SectionSummary & { description: string | null })[];
  sites: SiteSummary[];
}

export interface BoardCall {
  code: string;
  counter: string | null;
  section: string;
  color: string | null;
  status: TurnStatus;
  calledAt: string;
}

export interface Board {
  called: BoardCall[];
  sections: (SectionSummary & { waiting: number })[];
}

export interface QueueEvent {
  type: 'changed' | 'called' | 'ping';
  siteId: number | null;
  turn?: { code: string; counter: string; section: string };
}

export enum QueueRoutes {
  ATTEND = 'attend',
  KIOSK = 'kiosk',
  DISPLAY = 'display',
  TRACK = 'track-turn',
  AGENDA = 'agenda',
  BOOKING = 'booking',
  APPOINTMENT = 'appointment',
}

// ---------- citas ----------
export type AppointmentStatus = 'BOOKED' | 'CHECKED_IN' | 'CANCELLED' | 'NO_SHOW';

export interface ScheduleBlock {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface BookableService extends SectionSummary {
  description: string | null;
  durationMinutes: number;
  counters: { id: number; name: string }[];
}

export interface BookingConfig {
  name: string | null;
  businessType: string | null;
  enabled: boolean;
  bookingDays: number;
  services: BookableService[];
}

export interface Slot {
  startsAt: string;
  counters: { id: number; name: string }[];
}

export interface BookingPayload {
  sectionId: number;
  counterId?: number | null;
  startsAt: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  notes?: string | null;
  website?: string;
}

export interface PublicAppointment {
  token: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  customerName: string;
  service: string;
  color: string | null;
  counter: string;
  turn: { code: string; status: TurnStatus } | null;
}

export interface Appointment {
  id: number;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  notes: string | null;
  Section: SectionSummary;
  Counter: { id: number; name: string };
  Turn: { id: number; code: string; status: TurnStatus } | null;
}
