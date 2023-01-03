import Router from 'vue-router';
import LoginPage from '../pages/LoginPage.vue';
import DashboardPage from '../pages/DashboardPage.vue';

export const router = new Router({
  mode: 'history',
  base: '/',
  routes: [
    { path: '/', component: LoginPage },
    { path: '/dashboard', component: DashboardPage }
  ]
});
