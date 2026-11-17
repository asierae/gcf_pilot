import { Location } from '@angular/common';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { OrganizationService } from '../../services/organization.service';

/** Query parameter that carries the organization id in the wizard URLs. */
export const ORG_QUERY_PARAM = 'org';

/** Same shape the Worker accepts for organization / applicant ids. */
const ORGANIZATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/;

export function isOrganizationId(value: string | null | undefined): boolean {
  return typeof value === 'string' && ORGANIZATION_ID_PATTERN.test(value);
}

export function newOrganizationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Keeps `?org=<id>` in the address bar so an anonymous visitor can return to
 * the same draft link later.
 */
export function syncOrganizationId(location: Location, id: string): void {
  const [path, search = ''] = location.path().split('?');
  const params = new URLSearchParams(search);
  if (params.get(ORG_QUERY_PARAM) === id) {
    return;
  }
  params.set(ORG_QUERY_PARAM, id);
  location.replaceState(`${path}?${params.toString()}`);
}

/**
 * Async validator used by reactive forms. `organizationId` is a getter because
 * the id may be resolved after the form is created.
 */
export function acronymAvailabilityValidator(
  organizationService: OrganizationService,
  organizationId: () => string,
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    const value = (control.value ?? '').toString().trim();
    if (!value) {
      return of(null);
    }

    return timer(400).pipe(
      switchMap(() =>
        organizationService.isAcronymAvailable(value, organizationId()),
      ),
      map((available) => (available ? null : { acronymTaken: true })),
      catchError(() => of(null)),
    );
  };
}
