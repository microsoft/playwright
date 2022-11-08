import DashboardPage from '../pages/DashboardPage.vue';
import LoginPage from '../pages/LoginPage.vue';
import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory('/'),
  routes: [
    { path: '/', component: LoginPage },
    { path: '/dashboard', component: DashboardPage },
  ],
})
