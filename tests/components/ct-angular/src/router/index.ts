import { Routes } from '@angular/router';
import { DashboardComponent } from '@/pages/dashboard.component';
import { LoginComponent } from '@/pages/login.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
];
