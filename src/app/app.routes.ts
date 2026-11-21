import { Routes } from "@angular/router";
import { LayoutComponent } from "./layout/layout.component";
import { LandingComponent } from "./pages/landing/landing.component";
import { Stage1Component } from "./pages/stage1/stage1.component";
import { Stage2Component } from "./pages/stage2/stage2.component";
import { LoginComponent } from "./pages/login/login.component";
import { PasswordTokenComponent } from "./pages/auth/password-token/password-token.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { AccreditationSubmissionsComponent } from "./pages/dashboard/accreditation-submissions/accreditation-submissions.component";
import { OverviewDashboardComponent } from "./pages/dashboard/overview/overview-dashboard.component";
import { ApplicantDashboardComponent } from "./pages/dashboard/applicant/applicant-dashboard.component";
import { SubmissionDetailComponent } from "./pages/dashboard/submission-detail/submission-detail.component";
import { ReadinessDashboardComponent } from "./pages/dashboard/readiness-dashboard/readiness-dashboard.component";
import { LeadsImportComponent } from "./pages/dashboard/leads-import/leads-import.component";
import { UserManagementComponent } from "./pages/settings/user-management/user-management.component";
import { SendEmailComponent } from "./pages/settings/send-email/send-email.component";
import { AdminOrganizationsListComponent } from "./pages/admin/organizations/admin-organizations-list.component";
import { AdminOrganizationEditComponent } from "./pages/admin/organizations/admin-organization-edit.component";
import { PricingComponent } from "./pages/pricing/pricing.component";
import { ReadinessWizardComponent } from "./pages/readiness/readiness-wizard.component";
import { GetAssessedComponent } from "./pages/get-assessed/get-assessed.component";
import { ProfileAssessmentComponent } from "./pages/profile-assessment/profile-assessment.component";
import { MyFormsComponent } from "./pages/my-forms/my-forms.component";
import { MyOrganizationComponent } from "./pages/my-organization/my-organization.component";
import { adminGuard, authGuard, preScreeningGuard } from "./guards/auth.guard";

export const routes: Routes = [
  { path: "login", component: LoginComponent },
  { path: "reset-password", component: PasswordTokenComponent },
  { path: "accept-invite", component: PasswordTokenComponent },
  { path: "home", component: LandingComponent },
  { path: "get-assessed", component: GetAssessedComponent },
  { path: "profile-assessment", component: ProfileAssessmentComponent },
  { path: "", redirectTo: "home", pathMatch: "full" },
  {
    path: "",
    component: LayoutComponent,
    children: [
      { path: "stage1", component: Stage1Component },
      {
        path: "stage2",
        component: Stage2Component,
        canActivate: [authGuard, preScreeningGuard],
      },
      {
        path: "dashboard/applicant",
        component: ApplicantDashboardComponent,
        canActivate: [authGuard],
      },
      {
        path: "dashboard/overview",
        component: OverviewDashboardComponent,
        canActivate: [adminGuard],
      },
      {
        path: "dashboard",
        component: DashboardComponent,
        canActivate: [adminGuard],
      },
      {
        path: "dashboard/accreditation",
        component: AccreditationSubmissionsComponent,
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
      {
        path: "settings/send-email",
        component: SendEmailComponent,
        canActivate: [adminGuard],
      },
      {
        path: "admin/organizations",
        component: AdminOrganizationsListComponent,
       canActivate: [adminGuard],
      },
      {
        path: "admin/organizations/:id",
        component: AdminOrganizationEditComponent,
       canActivate: [adminGuard],
      },
      {
        path: "pricing",
        component: PricingComponent,
        canActivate: [adminGuard],
      },
      { path: "readiness", component: ReadinessWizardComponent },
      { path: "my-forms", component: MyFormsComponent, canActivate: [authGuard] },
      {
        path: "my-organization",
        component: MyOrganizationComponent,
        canActivate: [authGuard],
      },
    ],
  },
  { path: "**", redirectTo: "stage1" },
];
