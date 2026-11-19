import { Component, DestroyRef, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';
import { CONTACT_EMAIL } from '../../config/email.config';
import { AuthService } from '../../services/auth.service';

/**
 * Public pathway chooser shown by every "Get assessed" call to action.
 * It lets visitors pick readiness, pre-accreditation or a conversation with
 * an adviser instead of dropping everyone into the stage 1 form.
 */
@Component({
  selector: 'app-get-assessed',
  standalone: true,
  imports: [RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './get-assessed.component.html',
  styleUrl: './get-assessed.component.css',
})
export class GetAssessedComponent implements OnDestroy {
  readonly contactEmail = CONTACT_EMAIL;
  readonly contactMailto = `mailto:${CONTACT_EMAIL}?subject=GCF%20pathway%20guidance`;

  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private previousTitle = 'Avera Capital Access';

  constructor(
    private readonly title: Title,
    private readonly translate: TranslateService,
  ) {
    this.previousTitle = this.title.getTitle();
    this.syncDocumentTitle();
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncDocumentTitle());
  }

  ngOnDestroy(): void {
    this.title.setTitle(this.previousTitle);
  }

  /** Signed-in visitors get a direct route back into the portal. */
  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  get userName(): string {
    return this.authService.currentUserValue?.username ?? '';
  }

  get userInitials(): string {
    return this.userName.slice(0, 2).toUpperCase();
  }

  get portalLink(): string {
    return this.authService.currentUserValue?.role === 'admin'
      ? '/dashboard/overview'
      : '/my-forms';
  }

  private syncDocumentTitle(): void {
    const translated = this.translate.instant('GET_ASSESSED.META_TITLE');
    this.title.setTitle(
      translated && translated !== 'GET_ASSESSED.META_TITLE'
        ? translated
        : 'Choose your pathway — Avera Capital Access',
    );
  }
}
