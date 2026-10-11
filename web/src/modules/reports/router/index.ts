import type { RouteRecordRaw } from 'vue-router';

import isAdminGuard from 'src/modules/auth/router/guards/isAdminGuard';

const ReportsRouter: RouteRecordRaw[] = [
  {
    path: 'reportes',
    name: 'reports',
    beforeEnter: [isAdminGuard],
    component: () => import('../pages/ReportsPage.vue'),
  },
];

export default ReportsRouter;
