import type { RouteRecordRaw } from 'vue-router';

const HomeRouter: RouteRecordRaw[] = [
  {
    path: 'dashboard',
    name: 'dashboard',
    component: () => import('../pages/HomePage.vue'),
  },
];

export default HomeRouter;
