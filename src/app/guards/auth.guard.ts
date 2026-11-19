import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { OrganizationService } from '../services/organization.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

/** Accreditation opens only after the pre-screening has been passed. */
export const preScreeningGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const organizations = inject(OrganizationService);
  const router = inject(Router);

  if (!auth.isLoggedIn) {
    await router.navigate(['/login']);
    return false;
  }
  if (auth.currentUserValue?.role === 'admin') {
    return true;
  }

  const organizationId = auth.currentUserValue?.organizationId;
  if (!organizationId) {
    await router.navigate(['/my-forms']);
    return false;
  }

  try {
    const forms = await organizations.forms(organizationId);
    if (forms.preScreeningStatus === 'Passed') {
      return true;
    }
  } catch {
    // A failed lookup must not unlock a gated pathway.
  }

  await router.navigate(['/my-forms']);
  return false;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn && auth.currentUserValue?.role === 'admin') {
    return true;
  }

  // Signed-in applicants get their own dashboard instead of being bounced to
  // the login screen when they land on an admin-only route.
  if (auth.isLoggedIn) {
    router.navigate(['/dashboard/applicant']);
    return false;
  }

  router.navigate(['/login']);
  return false;
};
