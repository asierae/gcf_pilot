import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { Stage1Component } from './pages/stage1/stage1.component';
import { Stage2Component } from './pages/stage2/stage2.component';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SubmissionDetailComponent } from './pages/dashboard/submission-detail/submission-detail.component';
import { adminGuard, authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'stage1', pathMatch: 'full' },
      { path: 'stage1', component: Stage1Component },
      { path: 'stage2', component: Stage2Component, canActivate: [authGuard] },
      { path: 'dashboard', component: DashboardComponent, canActivate: [adminGuard] },
      { path: 'dashboard/submission/:id', component: SubmissionDetailComponent, canActivate: [adminGuard] }
    ]
  },
  { path: '**', redirectTo: 'stage1' }
];
