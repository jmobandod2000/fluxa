import { api } from 'src/boot/axios';
import type { TurnStatus } from 'src/modules/queue/interfaces/queue';

export interface Summary {
  issued: number;
  served: number;
  noShow: number;
  cancelled: number;
  avgWait: number | null;
  p90Wait: number | null;
  avgService: number | null;
}

export interface Report {
  from: string;
  to: string;
  summary: Summary;
  appointments: { booked: number; checkedIn: number; noShow: number; cancelled: number };
  byDay: (Summary & { date: string })[];
  byHour: { hour: number; issued: number; avgWait: number | null }[];
  bySection: (Summary & { section: string; color: string | null })[];
  byStaff: (Summary & { staff: string })[];
  detail: {
    code: string;
    date: string;
    section: string;
    status: TurnStatus;
    appointment: boolean;
    createdAt: string;
    calledAt: string | null;
    finishedAt: string | null;
    waitMinutes: number | null;
    serviceMinutes: number | null;
    counter: string | null;
    staff: string | null;
  }[];
}

export const getReport = async (from: string, to: string, siteId: number | null) =>
  (await api.get<Report>('queue/reports', { params: { from, to, ...(siteId ? { siteId } : {}) } }))
    .data;
