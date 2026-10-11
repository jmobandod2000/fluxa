import { api } from 'src/boot/axios';
import type {
  Appointment,
  BookingConfig,
  BookingPayload,
  PublicAppointment,
  Slot,
  Board,
  Counter,
  CounterPayload,
  PublicConfig,
  PublicTurn,
  Section,
  SectionPayload,
  StaffState,
  TodaySummary,
  Turn,
} from '../interfaces/queue';

// ---------- configuración ----------
export const getSections = async () => (await api.get<Section[]>('sections')).data;
export const createSection = async (payload: SectionPayload) =>
  (await api.post<Section>('sections', payload)).data;
export const updateSection = async (id: number, payload: Partial<SectionPayload>) =>
  (await api.patch<Section>(`sections/${id}`, payload)).data;
export const deleteSection = async (id: number) =>
  (await api.delete<Section>(`sections/${id}`)).data;
export const applySectionPreset = async (payload: {
  sections: { name: string; prefix: string }[];
  counterName: string;
}) => (await api.post<Section[]>('sections/preset', payload)).data;

export const getCounters = async () => (await api.get<Counter[]>('counters')).data;
export const createCounter = async (payload: CounterPayload) =>
  (await api.post<Counter>('counters', payload)).data;
export const updateCounter = async (id: number, payload: Partial<CounterPayload>) =>
  (await api.patch<Counter>(`counters/${id}`, payload)).data;
export const deleteCounter = async (id: number) =>
  (await api.delete<Counter>(`counters/${id}`)).data;

// ---------- equipo ----------
export const getToday = async () => (await api.get<TodaySummary>('queue/today')).data;
export const getStaffState = async (counterId: number) =>
  (await api.get<StaffState>(`queue/counters/${counterId}/state`)).data;
export const callNext = async (counterId: number) =>
  (await api.post<{ turn: Turn | null }>('queue/call-next', { counterId })).data;
export const turnAction = async (id: number, action: 'recall' | 'finish' | 'no-show' | 'cancel') =>
  (await api.post<Turn>(`queue/turns/${id}/${action}`)).data;
export const transferTurn = async (id: number, sectionId: number) =>
  (await api.post<Turn>(`queue/turns/${id}/transfer`, { sectionId })).data;

// ---------- público ----------
export const getPublicConfig = async () =>
  (await api.get<PublicConfig>('queue/public/config')).data;
export const issueTurn = async (sectionId: number, siteId: number | null) =>
  (await api.post<PublicTurn>('queue/public/turns', { sectionId, siteId })).data;
export const getPublicTurn = async (token: string) =>
  (await api.get<PublicTurn>(`queue/public/turns/${token}`)).data;
export const getBoard = async (siteId: number | null) =>
  (await api.get<Board>('queue/public/board', { params: siteId ? { siteId } : {} })).data;

export const streamUrl = (siteId: number | null) => {
  const base = (api.defaults.baseURL ?? '/api').replace(/\/$/, '');
  return `${base}/queue/public/stream${siteId ? `?siteId=${siteId}` : ''}`;
};

// ---------- citas ----------
export const getBookingConfig = async () =>
  (await api.get<BookingConfig>('appointments/public/config')).data;
export const getAvailability = async (
  sectionId: number,
  date: string,
  counterId: number | null,
  staff = false,
) =>
  (
    await api.get<Slot[]>(
      staff ? 'appointments/availability' : 'appointments/public/availability',
      {
        params: { sectionId, date, ...(counterId ? { counterId } : {}) },
      },
    )
  ).data;
export const bookAppointment = async (payload: BookingPayload, staff = false) =>
  (await api.post<PublicAppointment>(staff ? 'appointments' : 'appointments/public', payload)).data;
export const getPublicAppointment = async (token: string) =>
  (await api.get<PublicAppointment>(`appointments/public/${token}`)).data;
export const cancelPublicAppointment = async (token: string) =>
  (await api.post<PublicAppointment>(`appointments/public/${token}/cancel`)).data;
export const getAgenda = async (date: string) =>
  (await api.get<Appointment[]>('appointments', { params: { date } })).data;
export const appointmentAction = async (id: number, action: 'check-in' | 'cancel' | 'no-show') =>
  (await api.post(`appointments/${id}/${action}`)).data;
