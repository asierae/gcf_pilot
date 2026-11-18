import { Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { LandingComponent } from "./pages/landing/landing.component";
import { Stage1Component } from "./pages/stage1/stage1.component";
import { Stage2Component } from "./pages/stage2/stage2.component";
import { LoginComponent } from "./pages/login/login.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { SubmissionDetailComponent } from "./pages/dashboard/submission-detail/submission-detail.component";
import { ReadinessDashboardComponent } from "./pages/dashboard/readiness-dashboard/readiness-dashboard.component";
import { LeadsImportComponent } from "./pages/dashboard/leads-import/leads-import.component";
import { UserManagementComponent } from "./pages/settings/user-management/user-management.component";
import { PricingComponent } from "./pages/pricing/pricing.component";
import { ReadinessWizardComponent } from "./pages/readiness/readiness-wizard.component";
import { MyFormsComponent } from "./pages/my-forms/my-forms.component";
import { adminGuard, authGuard } from "./guards/auth.guard";

export const routes: Routes = [
  { path: "login", component: LoginComponent },
  { path: "home", component: LandingComponent },
  { path: "", redirectTo: "home", pathMatch: "full" },
  {
    path: "",
    component: LayoutComponent,
    children: [
      { path: "stage1", component: Stage1Component },
      { path: "stage2", component: Stage2Component, canActivate: [authGuard] },
      {
        path: "dashboard",
        component: DashboardComponent,
        canActivate: [adminGuard],
      },
      {
        path: "dashboard/leads",
        component: LeadsImportComponent,
        canActivate: [adminGuard],
      },
      {
        path: "dashboard/submission/:id",
        component: SubmissionDetailComponent,
        canActivate: [adminGuard],
      },
      {
        path: "dashboard/readiness",
        component: ReadinessDashboardComponent,
        canActivate: [adminGuard],
      },
      {
        path: "dashboard/readiness/:organizationId",
        component: ReadinessWizardComponent,
        canActivate: [adminGuard],
        data: { adminEdit: true },
      },
      {
        path: "settings/users",
        component: UserManagementComponent,
        canActivate: [adminGuard],
      },
      { path: "pricing", component: PricingComponent },
      { path: "readiness", component: ReadinessWizardComponent },
      { path: "my-forms", component: MyFormsComponent, canActivate: [authGuard] },
    ],
  },
  { path: "**", redirectTo: "stage1" },
];
