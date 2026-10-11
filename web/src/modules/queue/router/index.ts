import type { RouteRecordRaw } from 'vue-router';

import { QueueRoutes } from '../interfaces/queue';

// Panel del empleado (dentro del layout con sesión)
export const QueueStaffRouter: RouteRecordRaw[] = [
  {
    path: 'atender',
    name: QueueRoutes.ATTEND,
    component: () => import('../pages/StaffPanelPage.vue'),
  },
];

// Kiosco, pantalla y seguimiento: pantallas completas sin sesión
export const QueuePublicRouter: RouteRecordRaw[] = [
  { path: '/kiosco', name: QueueRoutes.KIOSK, component: () => import('../pages/KioskPage.vue') },
  { path: '/pantalla', name: QueueRoutes.DISPLAY, component: () => import('../pages/DisplayPage.vue') },
  {
    path: '/t/:token([A-Za-z0-9_-]{43})',
    name: QueueRoutes.TRACK,
    component: () => import('../pages/TrackTurnPage.vue'),
  },
];
